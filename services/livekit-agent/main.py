import logging
import json
import os
from datetime import datetime
from typing import Annotated
import asyncio
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
import socket

from dotenv import load_dotenv
from livekit import agents
from livekit.agents import (Agent, AgentSession,
                            JobProcess, RoomInputOptions,
                            RunContext, function_tool)
from livekit.plugins import deepgram, noise_cancellation, openai, silero
from pydantic import Field
import re

from user_data import UserData
from recording import start_s3_recording

# --- API integration imports ---
from api_client import (
    update_submission_s3_url_api, get_existing_answers_api,
    cleanup_api_client, submit_quiz_answer_api, create_lesson_performance_api,
    get_lesson_by_uri_and_token, get_lesson_by_id, record_lesson_submission_api,
    get_existing_lesson_submission_api
)

# from datadog import initialize, statsd

# options = {
#     "statsd_host": "dd-agent",  # internal DNS resolves inside Docker network
#     "statsd_port": 8125,
# }

# initialize(**options)


load_dotenv()

# Set up logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("futures_survey_assistant")
logger.setLevel(logging.INFO)

# Set all related loggers to INFO level
logging.getLogger("futures_survey_api").setLevel(logging.INFO)
logging.getLogger("livekit.agents").setLevel(logging.INFO)
logging.getLogger("livekit").setLevel(logging.INFO)
logging.getLogger("aiohttp").setLevel(logging.INFO)
logging.getLogger("asyncio").setLevel(logging.INFO)

# Suppress verbose external library logs
logging.getLogger("hpack.hpack").setLevel(logging.ERROR)
logging.getLogger("openai").setLevel(logging.WARNING)
logging.getLogger("openai._base_client").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("httpcore.http11").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)

# Global health status
health_status = {
    "status": "healthy",
    "timestamp": datetime.now().isoformat(),
    "uptime": 0,
    "start_time": datetime.now()
}

class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            # Update uptime
            health_status["uptime"] = (datetime.now() - health_status["start_time"]).total_seconds()
            health_status["timestamp"] = datetime.now().isoformat()

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()

            response = {
                "status": health_status["status"],
                "timestamp": health_status["timestamp"],
                "uptime_seconds": health_status["uptime"],
                "service": "livekit-agent"
            }

            self.wfile.write(json.dumps(response, indent=2).encode())
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'Not Found')

    def log_message(self, format, *args):
        # Suppress HTTP server logs to reduce noise
        pass

def start_health_server(port=8080):
    """Start the health check HTTP server in a separate thread"""
    def run_server():
        try:
            server = HTTPServer(('0.0.0.0', port), HealthCheckHandler)
            logger.info(f"Health check server started on port {port}")
            server.serve_forever()
        except Exception as e:
            logger.error(f"Failed to start health check server: {e}")

    health_thread = threading.Thread(target=run_server, daemon=True)
    health_thread.start()
    return health_thread

def update_health_status(status):
    """Update the global health status"""
    global health_status
    health_status["status"] = status
    health_status["timestamp"] = datetime.now().isoformat()
    logger.info(f"Health status updated to: {status}")

RunContext_T = RunContext[UserData]

# API-based operations - all database calls now go through the API client

def build_dynamic_prompt_from_lesson_data(lesson_data):
    """Build dynamic prompt from lesson data received from API."""
    logger.debug(f"Building dynamic prompt from lesson data: {lesson_data}")

    lesson = lesson_data.get("lesson", {})
    questions = lesson_data.get("questions", [])

    logger.debug(f"Lesson data: {lesson}")
    logger.debug(f"Questions data: {questions}")
    logger.debug(f"Number of questions: {len(questions)}")

    current_time = datetime.now().strftime('%A, %B %d, %Y at %I:%M %p')
    questions_section = ""
    for i, question in enumerate(questions):
        qid = question.get("id")
        qtext = question.get("question_text")
        qorder = question.get("question_order")
        is_quiz = question.get("is_quiz_question", False)
        correct_answer = question.get("correct_answer")
        points = question.get("points", 1)
        logger.debug(f"Processing question {i+1}: id={qid}, order={qorder}, text='{qtext}', is_quiz={is_quiz}")
        
        if is_quiz and correct_answer:
            questions_section += f"\n{qorder}) Question {qorder} (Quiz - {points} point{'s' if points != 1 else ''}):\n   \"{qtext}\"\n   Correct answer: \"{correct_answer}\"\n"
        else:
            questions_section += f"\n{qorder}) Question {qorder}:\n   \"{qtext}\"\n"

    purpose_explanation = lesson.get('purpose_explanation', 'Welcome! I am here to help you learn through an interactive quiz.')
    intro_prompt = lesson.get('intro_prompt', 'You are a friendly and encouraging AI voice teacher helping a student learn through interactive quizzes.')
    
    prompt = f"""
{intro_prompt}
Current date and time: {current_time}

LANGUAGE POLICY
Detect the participant's first reply.
Do not switch languages once the conversation has started, even if the participant does.
Never use special characters such as %, $, #, or *.

LESSON MODE - QUIZ INSTRUCTIONS
You are a supportive and encouraging teacher. Your role is to:
1. Help students learn through interactive quizzes
2. Evaluate answers and provide positive, constructive feedback
3. Be encouraging and supportive, even when answers are incorrect
4. Celebrate correct answers with enthusiasm
5. Use encouraging phrases like "Great job!", "Well done!", "You're doing great!", "Keep it up!"

LESSON FLOW (ask only one question at a time)

1) Welcome and explain purpose:
   {purpose_explanation}
{questions_section}
{len(questions) + 3}) Completion check:
   After the recap, call check_survey_complete to ensure all questions were answered.

{len(questions) + 4}) Closing:
   Lesson will automatically end when check_survey_complete confirms all questions are answered.
   Provide a summary of performance and encouraging closing remarks.

QUIZ EVALUATION
- For each quiz question, use evaluate_quiz_answer to check if the answer is correct
- Always provide positive feedback, even for incorrect answers
- For correct answers: Celebrate enthusiastically and explain why it's correct
- For incorrect answers: Be supportive, provide hints, and encourage them to try again if appropriate
- Track performance and provide encouragement throughout

DATA PROTECTION
- Each answer is automatically saved to the database as soon as it's captured.
- Quiz answers are evaluated and scored immediately.
- If you detect any issues with data submission, call watchdog_survey_completion to retry.

GENERAL GUIDELINES
Ask only one question at a time.
Respond in clear, complete sentences with enthusiasm and encouragement.
Be patient and supportive - learning takes time.
If the participant provides unexpected information, politely steer them back to the current question.
Always maintain a positive, encouraging tone.
"""
    return prompt, lesson, questions

# --- New functions for real-time progress tracking ---
async def send_progress_update(ctx: RunContext_T, current_question: str = None, last_answer: str = None, current_question_text: str = None):
    """Send progress update to frontend via data channel"""
    userdata = ctx.userdata

    progress_data = {
        "type": "survey_progress",
        "current_question_number": current_question,
        "current_question_text": current_question_text,
        "total_questions": len(userdata.questions),
        "answered_questions": len(userdata.questionnaire_answers),
        "last_answer": last_answer,
        "completion_percentage": round((len(userdata.questionnaire_answers) / len(userdata.questions)) * 100, 1) if userdata.questions else 0,
        "timestamp": datetime.now().isoformat()
    }

    try:
        # Use the room stored in userdata (set from JobContext)
        if hasattr(userdata, 'room') and userdata.room:
            data_payload = json.dumps(progress_data).encode('utf-8')
            await userdata.room.local_participant.publish_data(data_payload, reliable=True)
            logger.info(f"Progress update sent: {progress_data}")
        else:
            logger.warning("Room not available in userdata, cannot send progress update")
    except Exception as e:
        logger.error(f"Failed to send progress update: {e}")

async def send_transcript_update(ctx: RunContext_T, text: str, speaker: str):
    """Send transcript update to frontend via data channel"""
    userdata = ctx.userdata
    transcript_data = {
        "type": "transcript_update",
        "speaker": speaker,  # "agent" or "participant"
        "text": text,
        "timestamp": datetime.now().isoformat()
    }

    try:
        # Use the room stored in userdata (set from JobContext)
        if hasattr(userdata, 'room') and userdata.room:
            data_payload = json.dumps(transcript_data).encode('utf-8')
            await userdata.room.local_participant.publish_data(data_payload, reliable=True)
            logger.info(f"Transcript update sent: {speaker}: {text[:50]}...")
        else:
            logger.warning("Room not available in userdata, cannot send transcript update")
    except Exception as e:
        logger.error(f"Failed to send transcript update: {e}")

async def send_survey_status(ctx: RunContext_T, status: str, message: str = ""):
    """Send survey status updates (started, in_progress, completed, closing, error)"""
    userdata = ctx.userdata
    status_data = {
        "type": "survey_status",
        "status": status,  # "started", "in_progress", "completed", "closing", "error"
        "message": message,
        "timestamp": datetime.now().isoformat()
    }

    try:
        # Use the room stored in userdata (set from JobContext)
        if hasattr(userdata, 'room') and userdata.room:
            data_payload = json.dumps(status_data).encode('utf-8')
            await userdata.room.local_participant.publish_data(data_payload, reliable=True)
            logger.info(f"Survey status sent: {status} - {message}")
        else:
            logger.warning("Room not available in userdata, cannot send survey status")
    except Exception as e:
        logger.error(f"Failed to send survey status: {e}")


class MainAgent(Agent):
    def __init__(self, lesson_data) -> None:
        MAIN_PROMPT, self.lesson, self.questions = build_dynamic_prompt_from_lesson_data(lesson_data)
        logger.info(f"MainAgent initialized for lesson '{self.lesson.get('name', 'Unknown')}' with dynamic prompt: %s", MAIN_PROMPT)
        self.conversation_log = []  # Track conversation for transcript
        
        # Include quiz evaluation tool for lessons
        tools = [set_questionnaire_answer, check_survey_complete, watchdog_survey_completion, evaluate_quiz_answer]
        
        super().__init__(
            instructions=MAIN_PROMPT,
            tools=tools,
            tts=openai.TTS(voice="nova"),
        )

    async def on_enter(self) -> None:
        greeting = self.lesson.get("greeting") or "Hello, welcome to your lesson!"
        await self.session.say(greeting, allow_interruptions=False)

        # Note: We'll send initial progress updates after session is fully initialized
        # The session context will be available in the tools once the session starts

def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()

# --- Updated to use API ---
async def save_userdata_to_api(userdata: UserData, campaign_id: int, submission_id: str):
    # Save S3 recording URL if present (skip for fallback submission ID)
    if getattr(userdata, 's3_recording_url', None) and submission_id != "fallback-submission-id":
        success = await update_submission_s3_url_api(submission_id, userdata.s3_recording_url)
        if success:
            logger.info(f"Updated survey submission {submission_id} with S3 recording URL: {userdata.s3_recording_url}")
        else:
            logger.warning(f"Failed to update S3 recording URL for submission {submission_id}")
    elif getattr(userdata, 's3_recording_url', None) and submission_id == "fallback-submission-id":
        logger.warning("Cannot update S3 recording URL for fallback submission ID")
    elif getattr(userdata, 'recording_id', None):
        # Optionally, if you have a way to build the S3 URL from recording_id, do it here
        pass

    # Get existing answers to avoid duplicates (skip for fallback submission ID)
    if submission_id == "fallback-submission-id":
        existing_question_ids = []
        logger.info("Using fallback submission ID, skipping existing answers check")
    else:
        existing_question_ids = await get_existing_answers_api(submission_id)

    # Prepare all answers for batch submission
    answers_to_submit = []
    for q_num, answer in userdata.questionnaire_answers.items():
        # Find question ID from the questions stored in userdata
        question_id = None
        for question in userdata.questions:
            if question.get("question_order") == int(q_num):
                question_id = question.get("id")
                break

        if question_id and question_id not in existing_question_ids:
            answers_to_submit.append({
                "question_id": question_id,
                "answer_text": answer
            })
            logger.info(f"Prepared answer for question {q_num} for API submission.")
        elif question_id in existing_question_ids:
            logger.info(f"Answer for question {q_num} already exists, skipping.")
        else:
            logger.warning(f"Question id not found for question order {q_num}")

    # Submit all answers in batch if there are any (skip for fallback submission ID)
    if answers_to_submit and submission_id != "fallback-submission-id":
        try:
            from api_client import api_client
            await api_client.submit_answers(submission_id, answers_to_submit)
            logger.info(f"Successfully submitted {len(answers_to_submit)} answers to API.")
        except Exception as e:
            logger.error(f"Failed to submit answers to API: {e}")
            return False
    elif answers_to_submit and submission_id == "fallback-submission-id":
        logger.warning("Cannot submit answers for fallback submission ID - answers will be lost")
        return False

    return True

# --- NEW FUNCTION: Submit individual answer incrementally ---
async def submit_single_answer(userdata: UserData, question_number: str, answer: str) -> bool:
    """Submit a single answer to the API immediately after capture"""
    if userdata.submission_id == "fallback-submission-id":
        logger.warning(f"Cannot submit answer for question {question_number} - using fallback submission ID")
        return False

    # Check if this answer was already submitted
    if question_number in userdata.submitted_answers:
        logger.info(f"Answer for question {question_number} already submitted, skipping")
        return True

    # Find question ID from the questions stored in userdata
    question_id = None
    for question in userdata.questions:
        if question.get("question_order") == int(question_number):
            question_id = question.get("id")
            break

    if not question_id:
        logger.error(f"Question ID not found for question order {question_number}")
        # statsd.increment("survey.errors", tags=["type:question_id_not_found"])
        return False

    try:
        from api_client import api_client
        answer_data = {
            "question_id": question_id,
            "answer_text": answer
        }

        await api_client.submit_answers(userdata.submission_id, [answer_data])
        userdata.submitted_answers.add(question_number)
        logger.info(f"Successfully submitted answer for question {question_number} to API")
        
        # Track individual question answers
        # statsd.increment("survey.questions.answered")
        
        return True
    except Exception as e:
        logger.error(f"Failed to submit answer for question {question_number} to API: {e}")
        # statsd.increment("survey.errors", tags=["type:api_submission"])
        return False

# --- NEW FUNCTION: Finalization with disconnect protection ---
async def finalize_survey_with_protection(userdata: UserData, ctx: RunContext_T) -> bool:
    """Finalize survey with protection against disconnects"""
    if userdata.finalization_attempted:
        logger.info("Finalization already attempted, skipping")
        return userdata.survey_completed

    userdata.finalization_attempted = True

    # Check if all answers are submitted
    total_questions = len(userdata.questions)
    answered_questions = len(userdata.questionnaire_answers)
    submitted_questions = len(userdata.submitted_answers)

    logger.info(f"Finalization check: {answered_questions}/{total_questions} answered, {submitted_questions}/{total_questions} submitted")

    # Submit any missing answers with retry logic
    missing_submissions = []
    for q_num, answer in userdata.questionnaire_answers.items():
        if q_num not in userdata.submitted_answers:
            missing_submissions.append((q_num, answer))

    if missing_submissions:
        logger.info(f"Submitting {len(missing_submissions)} missing answers during finalization")

        # Retry logic for missing submissions
        max_retries = 3
        for attempt in range(max_retries):
            failed_submissions = []

            for q_num, answer in missing_submissions:
                success = await submit_single_answer(userdata, q_num, answer)
                if not success:
                    failed_submissions.append((q_num, answer))

            if not failed_submissions:
                logger.info(f"All missing answers submitted successfully on attempt {attempt + 1}")
                break
            elif attempt < max_retries - 1:
                logger.warning(f"Attempt {attempt + 1} failed for {len(failed_submissions)} answers, retrying...")
                missing_submissions = failed_submissions
                import asyncio
                await asyncio.sleep(1)  # Wait before retry
            else:
                logger.error(f"Failed to submit {len(failed_submissions)} answers after {max_retries} attempts")
                return False

    # Verify all answers are submitted
    final_submitted_count = len(userdata.submitted_answers)
    if final_submitted_count != total_questions:
        logger.error(f"Finalization failed: {final_submitted_count}/{total_questions} answers submitted")
        # statsd.increment("survey.errors", tags=["type:finalization"])
        return False

    # Mark lesson as completed
    userdata.survey_completed = True
    logger.info(f"Lesson marked as completed - all {total_questions} answers submitted to API")

    # Create lesson performance record
    if userdata.submission_id != "fallback-submission-id":
        try:
            # Calculate performance metrics
            quiz_questions = [q for q in userdata.questions if q.get("is_quiz_question", False)]
            total_quiz_questions = len(quiz_questions)
            correct_answers = userdata.correct_count
            total_points = userdata.total_points_possible
            points_earned = userdata.total_points_earned
            
            # Calculate score percentage
            score_percentage = 0.0
            if total_points > 0:
                score_percentage = (points_earned / total_points) * 100.0
            
            # Create lesson performance record
            lesson_id = userdata.lesson.get("id")
            if lesson_id:
                performance_success = await create_lesson_performance_api(
                    submission_id=userdata.submission_id,
                    lesson_id=lesson_id,
                    total_questions=total_quiz_questions if total_quiz_questions > 0 else total_questions,
                    correct_answers=correct_answers,
                    total_points=total_points if total_points > 0 else total_questions,
                    points_earned=points_earned,
                    score_percentage=score_percentage
                )
                if performance_success:
                    logger.info(f"Lesson performance record created: {correct_answers}/{total_quiz_questions} correct, {points_earned}/{total_points} points, {score_percentage:.1f}%")
                else:
                    logger.warning("Failed to create lesson performance record")
        except Exception as e:
            logger.error(f"Error creating lesson performance record: {e}")

    # Count total surveys completed
    # statsd.increment("survey.completed")

    # Send completion status
    await send_survey_status(ctx, "completed", "Lesson successfully completed and saved via API")

    # Send final progress update
    await send_progress_update(ctx, current_question=None, last_answer=None)

    return True

# --- Quiz evaluation helper function ---
def evaluate_answer_correctness(student_answer: str, correct_answer: str) -> bool:
    """Evaluate if a student's answer is correct (fuzzy matching for natural language)"""
    if not correct_answer:
        return False
    
    # Normalize both answers for comparison
    student_normalized = student_answer.lower().strip()
    correct_normalized = correct_answer.lower().strip()
    
    # Exact match
    if student_normalized == correct_normalized:
        return True
    
    # Check if student answer contains the correct answer (or vice versa)
    if correct_normalized in student_normalized or student_normalized in correct_normalized:
        return True
    
    # For numeric answers, try to compare as numbers
    try:
        student_num = float(student_normalized)
        correct_num = float(correct_normalized)
        if abs(student_num - correct_num) < 0.01:  # Allow small floating point differences
            return True
    except ValueError:
        pass
    
    # For now, return False if no match found
    # In production, you might want to use an LLM to evaluate semantic similarity
    return False

# --- Quiz answer submission with evaluation ---
async def submit_quiz_answer(userdata: UserData, question_number: str, answer: str) -> dict:
    """Submit a quiz answer with evaluation and scoring"""
    if userdata.submission_id == "fallback-submission-id":
        logger.warning(f"Cannot submit quiz answer for question {question_number} - using fallback submission ID")
        return {"success": False, "is_correct": False, "points": 0}
    
    # Find question details
    question_id = None
    question_data = None
    for question in userdata.questions:
        if question.get("question_order") == int(question_number):
            question_id = question.get("id")
            question_data = question
            break
    
    if not question_id or not question_data:
        logger.error(f"Question ID not found for question order {question_number}")
        return {"success": False, "is_correct": False, "points": 0}
    
    # Evaluate answer if it's a quiz question
    is_quiz = question_data.get("is_quiz_question", False)
    correct_answer = question_data.get("correct_answer")
    points_possible = question_data.get("points", 1)
    
    is_correct = False
    points_earned = 0
    feedback = None
    
    if is_quiz and correct_answer:
        is_correct = evaluate_answer_correctness(answer, correct_answer)
        if is_correct:
            points_earned = points_possible
            feedback = f"Correct! Well done! The answer is: {correct_answer}"
        else:
            points_earned = 0
            feedback = f"Not quite. The correct answer is: {correct_answer}. Keep trying, you're learning!"
    
    # Store in quiz_answers
    userdata.quiz_answers[question_number] = {
        "answer": answer,
        "is_correct": is_correct,
        "points": points_earned
    }
    
    # Update totals
    if is_quiz:
        userdata.total_points_earned += points_earned
        userdata.total_points_possible += points_possible
        if is_correct:
            userdata.correct_count += 1
    
    # Submit to API
    try:
        if is_quiz:
            success = await submit_quiz_answer_api(
                userdata.submission_id,
                question_id,
                answer,
                is_correct,
                points_earned,
                feedback,
                is_lesson=userdata.is_lesson_mode
            )
        else:
            # Regular answer submission
            from api_client import api_client
            answer_data = {
                "question_id": question_id,
                "answer_text": answer
            }
            await api_client.submit_answers(userdata.submission_id, [answer_data])
            success = True
        
        if success:
            logger.info(f"Quiz answer for question {question_number} submitted: correct={is_correct}, points={points_earned}")
            return {
                "success": True,
                "is_correct": is_correct,
                "points": points_earned,
                "feedback": feedback
            }
    except Exception as e:
        logger.error(f"Failed to submit quiz answer: {e}")
    
    return {"success": False, "is_correct": is_correct, "points": points_earned, "feedback": feedback}

@function_tool
async def evaluate_quiz_answer(
    question_number: Annotated[str, Field(description="The question number (e.g., '1', '2', '3')")],
    answer: Annotated[str, Field(description="The student's answer to evaluate")],
    ctx: RunContext_T
) -> str:
    """Evaluate a quiz answer and provide feedback. Use this for quiz questions."""
    userdata = ctx.userdata
    
    # Submit and evaluate the answer
    result = await submit_quiz_answer(userdata, question_number, answer)
    
    if result["success"]:
        if result["is_correct"]:
            encouragement = "Excellent work! " + result.get("feedback", "That's correct!")
            userdata.performance_feedback.append(f"Q{question_number}: Correct - {encouragement}")
            return encouragement
        else:
            supportive = "Good effort! " + result.get("feedback", "Let's try the next one.")
            userdata.performance_feedback.append(f"Q{question_number}: Incorrect - {supportive}")
            return supportive
    else:
        return "Answer recorded, but evaluation may be incomplete."

@function_tool
async def set_questionnaire_answer(
    question_number: Annotated[str, Field(description="The question number (e.g., '1', '2', '3')")],
    answer: Annotated[str, Field(description="The answer")],
    ctx: RunContext_T
) -> str:
    import time
    start_time = time.time()
    
    try:
        userdata = ctx.userdata
        userdata.questionnaire_answers[question_number] = answer

        # Check if this is a quiz question
        question_data = None
        for question in userdata.questions:
            if question.get("question_order") == int(question_number):
                question_data = question
                break
        
        if question_data and question_data.get("is_quiz_question", False):
            # Use quiz evaluation
            result = await submit_quiz_answer(userdata, question_number, answer)
            if result["success"]:
                logger.info(f"Quiz answer for question {question_number} evaluated and submitted: correct={result['is_correct']}")
            else:
                logger.warning(f"Failed to submit quiz answer for question {question_number}")
        else:
            # Regular answer submission for non-quiz questions
            submission_success = await submit_single_answer(userdata, question_number, answer)
            if submission_success:
                logger.info(f"Answer for question {question_number} submitted to API immediately")
            else:
                logger.warning(f"Failed to submit answer for question {question_number} to API - will retry during finalization")
    except Exception as e:
        # Track general errors
        # statsd.increment("survey.errors", tags=["type:general"])
        logger.error(f"Error in set_questionnaire_answer: {e}")
        raise
    finally:
        # Track response latency in ms
        duration_ms = int((time.time() - start_time) * 1000)
        # statsd.histogram("survey.response_time", duration_ms)

    # Find current question text
    current_question_text = None
    for question in userdata.questions:
        if question.get("question_order") == int(question_number):
            current_question_text = question.get("question_text")
            break

    # Send transcript update for participant answer
    await send_transcript_update(ctx, answer, "participant")

    # Determine next question
    next_question_num = str(int(question_number) + 1)
    next_question_text = None

    if int(question_number) < len(userdata.questions):
        for question in userdata.questions:
            if question.get("question_order") == int(next_question_num):
                next_question_text = question.get("question_text")
                break

    # Send progress update with current answer and next question info
    await send_progress_update(
        ctx,
        current_question=next_question_num if next_question_text else None,
        last_answer=answer,
        current_question_text=next_question_text
    )

    logger.info(f"Question {question_number} answer set: {answer}")
    logger.info(f"All questionnaire answers: {userdata.questionnaire_answers}")
    logger.info(f"Submitted answers: {userdata.submitted_answers}")

    if len(userdata.questionnaire_answers) == len(userdata.questions):
        await send_survey_status(ctx, "in_progress", "All questions answered, ready for completion")
        return f"Answer for question {question_number} has been saved and submitted to API. Lesson complete - ready for finalization: {answer}"
    else:
        return f"Answer for question {question_number} has been saved and submitted to API: {answer}"

@function_tool
async def check_survey_complete(ctx: RunContext_T) -> str:
    userdata = ctx.userdata
    total_questions = len(userdata.questions)
    answered_questions = len(userdata.questionnaire_answers)
    submitted_questions = len(userdata.submitted_answers)
    logger.info(f"Lesson completion check: {answered_questions}/{total_questions} questions answered, {submitted_questions}/{total_questions} submitted")

    if answered_questions == total_questions:
        # Use the new finalization with disconnect protection
        finalization_success = await finalize_survey_with_protection(userdata, ctx)

        if finalization_success:
            logger.info("Lesson completed - all data saved to API with disconnect protection")

            # Synchronous finalization step - block until API confirms
            logger.info("Synchronously confirming lesson completion with API...")

            # Verify all answers are in the database by checking submission status
            try:
                from api_client import api_client
                # This could be enhanced to actually verify the data in the database
                # For now, we'll just log the confirmation
                logger.info(f"Lesson submission {userdata.submission_id} confirmed complete with {len(userdata.submitted_answers)} answers")
            except Exception as e:
                logger.warning(f"Could not verify lesson completion with API: {e}")

            # Automatically end the call after completion
            closing_message = userdata.lesson.get("closing", "Thank you for completing the lesson. Great job! Goodbye!")

            # Say the closing message first
            if hasattr(userdata, 'session') and userdata.session:
                await userdata.session.say(closing_message, allow_interruptions=False)

            # Send closing status and end the call
            await send_survey_status(ctx, "closing", "Lesson completed, ending call")
            logger.info("Lesson call ending - closing status sent")

            # End the session using the correct method
            if hasattr(userdata, 'session') and userdata.session:
                try:
                    await userdata.session.aclose()
                except Exception as e:
                    logger.warning(f"Error closing session: {e}")
                    # Session may already be closed or closing, which is fine

            return f"Lesson complete! Said closing message and ended the call."
        else:
            logger.error("Failed to finalize lesson - data may be lost")
            await send_survey_status(ctx, "error", "Failed to save lesson data")
            return f"Lesson completion failed - please try again."
    else:
        missing_questions = [str(question.get("question_order")) for question in userdata.questions if str(question.get("question_order")) not in userdata.questionnaire_answers]
        await send_survey_status(ctx, "in_progress", f"Lesson incomplete. Missing questions: {missing_questions}")
        return f"Lesson is not complete. {answered_questions}/{total_questions} questions answered. Missing questions: {missing_questions}"

@function_tool
async def end_call(ctx: RunContext_T) -> str:
    """End the lesson call after sending closing status"""
    userdata = ctx.userdata

    # Send closing status to indicate the call is ending
    await send_survey_status(ctx, "closing", "Lesson completed, ending call")

    logger.info("Lesson call ending - closing status sent")

    return "Call ended successfully"

@function_tool
async def watchdog_survey_completion(ctx: RunContext_T) -> str:
    """Watchdog function to check lesson completion and retry submissions if needed"""
    userdata = ctx.userdata
    total_questions = len(userdata.questions)
    answered_questions = len(userdata.questionnaire_answers)
    submitted_questions = len(userdata.submitted_answers)

    logger.info(f"Watchdog check: {answered_questions}/{total_questions} answered, {submitted_questions}/{total_questions} submitted")

    # If all questions are answered but not all submitted, retry submissions
    if answered_questions == total_questions and submitted_questions < total_questions:
        logger.info("Watchdog: All questions answered but not all submitted - retrying submissions")

        # Submit any missing answers
        missing_submissions = []
        for q_num, answer in userdata.questionnaire_answers.items():
            if q_num not in userdata.submitted_answers:
                missing_submissions.append((q_num, answer))

        if missing_submissions:
            logger.info(f"Watchdog: Submitting {len(missing_submissions)} missing answers")
            for q_num, answer in missing_submissions:
                success = await submit_single_answer(userdata, q_num, answer)
                if success:
                    logger.info(f"Watchdog: Successfully submitted answer for question {q_num}")
                else:
                    logger.warning(f"Watchdog: Failed to submit answer for question {q_num}")

    # If all questions are answered and submitted but not completed, finalize
    if (answered_questions == total_questions and
        submitted_questions == total_questions and
        not userdata.survey_completed):
        logger.info("Watchdog: All questions answered and submitted but not completed - finalizing")

        success = await finalize_survey_with_protection(userdata, ctx)
        if success:
            logger.info("Watchdog: Successfully finalized lesson")
            return "Lesson finalized successfully via watchdog"
        else:
            logger.error("Watchdog: Failed to finalize lesson")
            return "Lesson finalization failed via watchdog"

    return f"Watchdog check complete: {answered_questions}/{total_questions} answered, {submitted_questions}/{total_questions} submitted, completed: {userdata.survey_completed}"

def extract_phone_from_room_name(room_name: str) -> str:
    """Extract phone number from room name for phone call patterns."""
    pattern = r'call-_(\+\d+)_'
    match = re.search(pattern, room_name)
    if match:
        return match.group(1)
    return None

def extract_email_from_room_name(room_name: str) -> str:
    """Extract email from room name for email survey patterns."""
    # Check if this is an email survey room pattern
    if room_name.startswith('survey-'):
        # This would need to be implemented based on your email survey creation logic
        # For now, return None as phone number extraction doesn't apply
        return None
    return None

async def entrypoint(ctx: agents.JobContext):
    room = ctx.room
    room_name = room.name

    # Extract identifier (phone or email) from room name
    phone_number = extract_phone_from_room_name(room_name)
    email = extract_email_from_room_name(room_name)

    # Determine participant identifier
    participant_id = phone_number if phone_number else (email if email else "unknown")

    logger.info(f"Room name: {room_name}")
    logger.info(f"Participant ID: {participant_id}")

    # Increment when a new session starts
    # statsd.increment("livekit.sessions.active")

    # Check if lesson submission already exists for this room
    existing_lesson_submission = await get_existing_lesson_submission_api(room_name)
    lesson_data = None
    submission_id = None

    if existing_lesson_submission:
        # Lesson submission already exists
        logger.info(f"Lesson submission already exists for room {room_name} (ID: {existing_lesson_submission['id']})")
        logger.debug(f"Existing lesson submission data: {existing_lesson_submission}")
        submission_id = existing_lesson_submission['id']
        lesson_id = existing_lesson_submission.get('lesson_id')

        try:
            logger.debug(f"Getting lesson data for ID: {lesson_id}")
            lesson_data = await get_lesson_by_id(lesson_id)
            logger.debug(f"Lesson data received: {lesson_data}")
        except Exception as e:
            logger.error(f"Failed to get lesson data from API: {e}")
            # Fallback to basic lesson info
            lesson_data = {
                "lesson": {
                    "id": lesson_id,
                    "name": "Fallback Lesson",
                    "intro_prompt": "You are a friendly and encouraging AI voice teacher.",
                    "purpose_explanation": "Welcome! I'm here to help you learn.",
                    "greeting": "Hello, welcome to your lesson!",
                    "closing": "Thank you for completing the lesson. Great job!"
                },
                "questions": []
            }
    else:
        # For new submissions, parse room name to extract URI and link token
        if "-" in room_name:
            base_pattern = room_name.rsplit("-", 1)[0]
            uri = base_pattern
            link_token = base_pattern
        else:
            uri = "default"
            link_token = room_name

        # Get lesson data
        try:
            logger.debug(f"Trying to get lesson for URI: {uri}")
            lesson_data = await get_lesson_by_uri_and_token(uri, link_token)
            lesson = lesson_data.get("lesson", {})

            # Create new lesson submission via API
            link_type = "phone" if phone_number else "email" if email else "generic"
            submission_response = await record_lesson_submission_api(
                lesson_id=lesson["id"],
                link_token=link_token,
                link_type=link_type,
                room_name=room_name,
                s3_recording_url=None
            )
            submission_id = submission_response
            logger.info(f"New lesson submission created via API with id: {submission_id}")

        except Exception as e:
            logger.error(f"Failed to get lesson or create submission via API: {e}")
            # Fallback to basic lesson data
            lesson_data = {
                "lesson": {
                    "id": 1,
                    "name": "Default Lesson",
                    "intro_prompt": "You are a friendly and encouraging AI voice teacher.",
                    "purpose_explanation": "Welcome! I'm here to help you learn.",
                    "greeting": "Hello, welcome to your lesson!",
                    "closing": "Thank you for completing the lesson. Great job!"
                },
                "questions": []
            }
            submission_id = "fallback-submission-id"

    # Initialize user data
    userdata = UserData()
    userdata.customer_phone = phone_number if phone_number else None
    userdata.customer_email = email if email else None

    # Create main agent with lesson data from API
    userdata.agents.update({
        "main_agent": MainAgent(lesson_data),
    })
    userdata.questions = userdata.agents["main_agent"].questions
    
    # Store lesson dict in userdata
    userdata.lesson = lesson_data.get("lesson", {})
    userdata.campaign = userdata.lesson  # Keep for backward compatibility
    
    userdata.submission_id = submission_id  # Set submission_id instead of call_id
    userdata.room = ctx.room  # Store room reference for data publishing

    # For backward compatibility, also set call_id to submission_id
    userdata.call_id = submission_id
    
    # Set lesson mode (always true now)
    userdata.is_lesson_mode = True
    logger.info("Lesson mode enabled - quiz evaluation will be used")
    # Initialize performance tracking
    userdata.total_points_possible = sum(q.get("points", 1) for q in userdata.questions if q.get("is_quiz_question", False))

    # Start S3 voice recording only if not already started
    if not existing_lesson_submission or not existing_lesson_submission.get('s3_recording_url'):
        recording_success = await start_s3_recording(room_name, userdata)
        if recording_success:
            logger.info("S3 Recording started successfully")
            # Update the submission with the recording URL via API (skip for fallback submission ID)
            if hasattr(userdata, 's3_recording_url') and userdata.s3_recording_url and submission_id != "fallback-submission-id":
                success = await update_submission_s3_url_api(submission_id, userdata.s3_recording_url, is_lesson=True)
                if not success:
                    logger.warning(f"Failed to update S3 recording URL via API for lesson submission {submission_id}")
            elif hasattr(userdata, 's3_recording_url') and userdata.s3_recording_url and submission_id == "fallback-submission-id":
                logger.warning("Cannot update S3 recording URL for fallback submission ID")
        else:
            logger.warning("S3 Recording failed, continuing without recording")
            userdata.s3_recording_url = None  # Explicitly set to None if failed
    else:
        logger.info(f"S3 Recording already exists for this lesson submission")
        userdata.s3_recording_url = existing_lesson_submission.get('s3_recording_url')

    await ctx.connect()
    session = AgentSession(
        userdata=userdata,
        stt=deepgram.STT(model="nova-3", language="en-US"),
        llm=openai.LLM(model="gpt-4o-mini"),
        tts=openai.TTS(voice="nova"),
        vad=silero.VAD.load(),
        max_tool_steps=5,
    )
    userdata.session = session
    # Set up disconnect detection before starting session
    def on_participant_disconnected(participant):
        """Handle when a participant disconnects - synchronous wrapper"""
        logger.info(f"Participant {participant.identity} disconnected")

        # Decrement on disconnect
        # statsd.decrement("livekit.sessions.active")

        # If this is the main participant (not the agent), run finalization
        if participant.identity != "agent":
            logger.info("Main participant disconnected - running finalization")

            # Create async task for finalization
            async def run_finalization():
                # Create a minimal context for finalization
                class DisconnectContext:
                    def __init__(self, userdata):
                        self.userdata = userdata

                disconnect_ctx = DisconnectContext(userdata)

                try:
                    # Attempt finalization with a timeout
                    import asyncio
                    finalization_success = await asyncio.wait_for(
                        finalize_survey_with_protection(userdata, disconnect_ctx),
                        timeout=5.0  # 5 second timeout for finalization
                    )

                    if finalization_success:
                        logger.info("Successfully finalized survey during participant disconnect")
                    else:
                        logger.warning("Failed to finalize survey during participant disconnect - data may be lost")

                except asyncio.TimeoutError:
                    logger.error("Finalization timeout during participant disconnect - data may be lost")
                    # statsd.increment("survey.errors", tags=["type:disconnect_timeout"])
                except Exception as e:
                    logger.error(f"Error during participant disconnect finalization: {e}")
                    # statsd.increment("survey.errors", tags=["type:disconnect_finalization"])

            # Create the async task
            import asyncio
            asyncio.create_task(run_finalization())

    # Register the disconnect handler with the room
    ctx.room.on("participant_disconnected", on_participant_disconnected)

    # Set up periodic watchdog checks
    async def periodic_watchdog():
        """Run periodic watchdog checks every 30 seconds"""
        import asyncio

        while True:
            try:
                await asyncio.sleep(30)  # Check every 30 seconds

                # Only run watchdog if we have answers but haven't completed
                if (userdata.questionnaire_answers and
                    not userdata.survey_completed and
                    hasattr(userdata, 'session') and userdata.session):

                    logger.info("Running periodic watchdog check")

                    # Create a minimal context for watchdog
                    class WatchdogContext:
                        def __init__(self, userdata):
                            self.userdata = userdata

                    watchdog_ctx = WatchdogContext(userdata)

                    try:
                        await watchdog_survey_completion(watchdog_ctx)
                    except Exception as e:
                        logger.error(f"Error in periodic watchdog: {e}")
                        # statsd.increment("survey.errors", tags=["type:watchdog"])

            except asyncio.CancelledError:
                logger.info("Periodic watchdog cancelled")
                break
            except Exception as e:
                logger.error(f"Error in periodic watchdog loop: {e}")
                await asyncio.sleep(5)  # Wait before retrying

    # Start the periodic watchdog as a background task
    import asyncio
    watchdog_task = asyncio.create_task(periodic_watchdog())

    try:
        await session.start(
            agent=userdata.agents["main_agent"],
            room=ctx.room,
            room_input_options=RoomInputOptions(
                noise_cancellation=noise_cancellation.BVC(),
            ),
        )
    except Exception as e:
        # Track STT/session errors
        # statsd.increment("survey.errors", tags=["type:stt"])
        logger.error(f"Error starting session: {e}")
        raise

    # Send the first question to the frontend after session starts
    # Send directly using userdata.room without creating a RunContext
    if userdata.questions:
        # Count surveys started
        # statsd.increment("survey.started")
        
        first_question = userdata.questions[0]  # Dictionary with question data

        # Send progress update with first question
        progress_data = {
            "type": "survey_progress",
            "current_question_number": "1",
            "current_question_text": first_question.get("question_text"),
            "total_questions": len(userdata.questions),
            "answered_questions": 0,
            "last_answer": None,
            "completion_percentage": 0.0,
            "timestamp": datetime.now().isoformat()
        }

        # Send status update
        status_data = {
            "type": "survey_status",
            "status": "started",
            "message": "Survey has begun with first question",
            "timestamp": datetime.now().isoformat()
        }

        try:
            if userdata.room:
                # Send progress update
                progress_payload = json.dumps(progress_data).encode('utf-8')
                await userdata.room.local_participant.publish_data(progress_payload, reliable=True)
                logger.info(f"First question progress update sent: {progress_data}")

                # Send status update
                status_payload = json.dumps(status_data).encode('utf-8')
                await userdata.room.local_participant.publish_data(status_payload, reliable=True)
                logger.info(f"Survey status sent: started - Survey has begun with first question")

                logger.info(f"First question sent to frontend: {first_question.get('question_text')}")
            else:
                logger.warning("Room not available in userdata, cannot send first question")
        except Exception as e:
            logger.error(f"Failed to send first question update: {e}")

    # Cleanup API client resources
    try:
        await cleanup_api_client()
    except Exception as e:
        logger.warning(f"Failed to cleanup API client: {e}")

if __name__ == "__main__":
    # Start health check server
    health_port = int(os.environ.get('HEALTH_CHECK_PORT', '8080'))
    health_thread = start_health_server(port=health_port)
    update_health_status("starting")
    
    try:
        #agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm, agent_name="alex-telephony-agent"))
        update_health_status("running")
        agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm))
    except Exception as e:
        update_health_status("error")
        logger.error(f"LiveKit agent failed to start: {e}")
        raise
    finally:
        update_health_status("stopped")