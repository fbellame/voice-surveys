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

# --- Supabase integration imports ---
from supabase_client import quiz_client

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

# Supabase-based operations - all database calls now go through the Supabase client

def build_dynamic_prompt_from_quiz_data(quiz_data):
    """Build dynamic prompt from quiz data received from Supabase."""
    logger.debug(f"Building dynamic prompt from quiz data: {quiz_data}")

    quiz = quiz_data.get("quiz", {})
    questions = quiz_data.get("questions", [])

    logger.debug(f"Quiz data: {quiz}")
    logger.debug(f"Questions data: {questions}")
    logger.debug(f"Number of questions: {len(questions)}")

    current_time = datetime.now().strftime('%A, %B %d, %Y at %I:%M %p')
    questions_section = ""
    for i, question in enumerate(questions):
        qid = question.get("id")
        qtext = question.get("question_text")
        qorder = question.get("question_order")
        is_quiz = question.get("is_quiz_question", True)  # All quiz questions are quiz questions
        correct_answer = question.get("correct_answer")
        points = question.get("points", 1)
        logger.debug(f"Processing question {i+1}: id={qid}, order={qorder}, text='{qtext}', is_quiz={is_quiz}")
        
        if is_quiz and correct_answer:
            questions_section += f"\n{qorder}) Question {qorder} (Quiz - {points} point{'s' if points != 1 else ''}):\n   \"{qtext}\"\n   Correct answer: \"{correct_answer}\"\n"
        else:
            questions_section += f"\n{qorder}) Question {qorder}:\n   \"{qtext}\"\n"

    purpose_explanation = quiz.get('purpose_explanation', 'Welcome! I am here to help you learn through an interactive quiz.')
    intro_prompt = quiz.get('intro_prompt', 'You are a friendly and encouraging AI voice teacher helping a student learn through interactive quizzes.')
    
    # Get first question text for the prompt
    first_question_text = ""
    if questions and len(questions) > 0:
        first_question_text = questions[0].get('question_text', '')
    
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

IMPORTANT: After saying the welcome message, IMMEDIATELY ask the first question without waiting for the participant to respond. Do not pause or wait - go straight from the welcome to asking Question 1.

CRITICAL: When asking ANY question, you MUST call the ask_question function FIRST with the question number BEFORE saying the question text. This updates the frontend to show the correct question.

1) Welcome and explain purpose, then IMMEDIATELY ask Question 1:
   Say: "{purpose_explanation}" 
   Then call ask_question with question_number="1" FIRST
   Then IMMEDIATELY ask: "{first_question_text}"
   Do not wait for a response - ask the question right away.

{questions_section}
{len(questions) + 3}) Completion check:
   After the recap, call check_survey_complete to ensure all questions were answered.

{len(questions) + 4}) Closing:
   Lesson will automatically end when check_survey_complete confirms all questions are answered.
   Provide a summary of performance and encouraging closing remarks.

QUIZ EVALUATION
- For each quiz question, use evaluate_quiz_answer to check if the answer is correct
- ALWAYS wait for the participant to provide their answer before evaluating
- When you hear the participant speak after asking a question, that is their answer - process it immediately
- IMPORTANT: You MUST actively listen for the participant's response. The system will transcribe their speech automatically.
- When you receive ANY speech input from the participant after asking a question, treat it as their answer and process it immediately using evaluate_quiz_answer
- Do not wait for silence or pause - process the answer as soon as you receive it
- Always provide positive feedback, even for incorrect answers
- For correct answers: Celebrate enthusiastically and explain why it's correct
- For incorrect answers: Be supportive, provide hints, and encourage them to try again if appropriate
- Track performance and provide encouragement throughout
- After evaluating an answer, ask the next question (if there are more questions)
- CRITICAL: When asking the next question, you MUST call ask_question with the question number FIRST, then say the question text

DATA PROTECTION
- Each answer is automatically saved to the database as soon as it's captured.
- Quiz answers are evaluated and scored immediately.
- If you detect any issues with data submission, call watchdog_survey_completion to retry.

GENERAL GUIDELINES
Ask only one question at a time.
CRITICAL: Before asking ANY question, you MUST call ask_question with the question number FIRST. This ensures the frontend displays the correct question.
After asking a question, ALWAYS wait for and listen to the participant's response.
When the participant speaks, process their answer immediately using the appropriate tools.
The speech-to-text system will automatically transcribe what the participant says - you will receive their words as text.
When you receive text input from the participant after asking a question, that is their answer - process it immediately.
Respond in clear, complete sentences with enthusiasm and encouragement.
Be patient and supportive - learning takes time.
If the participant provides unexpected information, politely steer them back to the current question.
Always maintain a positive, encouraging tone.

CRITICAL LISTENING INSTRUCTIONS:
1. Before asking any question, you MUST call ask_question with the question number FIRST
2. After asking any question, you MUST wait for the participant to respond
3. The system will automatically transcribe their speech and send it to you as text
4. As soon as you receive ANY text input from the participant after asking a question, treat it as their answer
5. Immediately call evaluate_quiz_answer with the question number and their answer text
6. Do not continue speaking or ask another question until you have received and processed their answer
7. Listen actively - the participant's speech will appear as text in your conversation
"""
    return prompt, quiz, questions

# --- New functions for real-time progress tracking ---
async def send_progress_update(ctx: RunContext_T, current_question: str = None, last_answer: str = None, current_question_text: str = None):
    """Send progress update to frontend via data channel"""
    userdata = ctx.userdata

    # Ensure current_question is always a string (convert None to None but keep as string for JSON)
    current_question_str = str(current_question) if current_question is not None else None

    progress_data = {
        "type": "survey_progress",
        "current_question_number": current_question_str,
        "current_question_text": current_question_text,
        "total_questions": len(userdata.questions),
        "answered_questions": len(userdata.questionnaire_answers),
        "last_answer": last_answer,
        "completion_percentage": round((len(userdata.questionnaire_answers) / len(userdata.questions)) * 100, 1) if userdata.questions else 0,
        "timestamp": datetime.now().isoformat()
    }
    
    logger.info(f"Sending progress update: question={current_question_str}, answered={len(userdata.questionnaire_answers)}, total={len(userdata.questions)}")

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

async def send_quiz_recap(ctx: RunContext_T, userdata: UserData, attempt_data: dict = None):
    """Send quiz recap with score, all answers, and correct answers to frontend"""
    try:
        if not hasattr(userdata, 'room') or not userdata.room:
            logger.warning("Room not available, cannot send quiz recap")
            return
        
        # Build recap data from userdata and attempt_data
        total_questions = len(userdata.questions)
        correct_count = userdata.correct_count
        score_percentage = round((correct_count / total_questions * 100), 1) if total_questions > 0 else 0
        
        # Build question recap list
        recap_questions = []
        for question in userdata.questions:
            q_order = question.get("question_order")
            q_num = str(q_order)
            
            # Get user's answer
            user_answer = userdata.questionnaire_answers.get(q_num, "No answer provided")
            
            # Get correct answer
            correct_answer = question.get("correct_answer")
            if isinstance(correct_answer, dict):
                # Handle structured answers (e.g., MCQ options)
                correct_answer = correct_answer.get("value") or str(correct_answer)
            correct_answer_str = str(correct_answer) if correct_answer else "N/A"
            
            # Check if correct (use local evaluation)
            is_correct = False
            if correct_answer:
                is_correct = evaluate_answer_correctness(user_answer, str(correct_answer))
            
            # Get answer details from attempt_data if available (for graded results)
            points_earned = 0
            if attempt_data and attempt_data.get("answers"):
                for answer_data in attempt_data["answers"]:
                    answer_question = answer_data.get("question", {})
                    if answer_question.get("question_order") == q_order:
                        points_earned = answer_data.get("points_earned", 1 if is_correct else 0)
                        # Use graded result if available
                        if answer_data.get("is_correct") is not None:
                            is_correct = answer_data.get("is_correct", False)
                        break
            
            recap_questions.append({
                "question_number": q_num,
                "question_text": question.get("question_text", ""),
                "user_answer": user_answer,
                "correct_answer": correct_answer_str,
                "is_correct": is_correct,
                "points_earned": points_earned,
                "rationale": question.get("rationale", "")
            })
        
        # Sort by question order
        recap_questions.sort(key=lambda x: int(x["question_number"]))
        
        # Build recap data
        recap_data = {
            "type": "quiz_recap",
            "total_questions": total_questions,
            "correct_answers": correct_count,
            "incorrect_answers": total_questions - correct_count,
            "score_percentage": score_percentage,
            "points_earned": sum(q.get("points_earned", 0) for q in recap_questions),
            "total_points": total_questions,
            "questions": recap_questions,
            "timestamp": datetime.now().isoformat()
        }
        
        # Send recap to frontend
        recap_payload = json.dumps(recap_data).encode('utf-8')
        await userdata.room.local_participant.publish_data(recap_payload, reliable=True)
        logger.info(f"Quiz recap sent: {correct_count}/{total_questions} correct ({score_percentage}%)")
        
    except Exception as e:
        logger.error(f"Failed to send quiz recap: {e}")


class MainAgent(Agent):
    def __init__(self, quiz_data) -> None:
        MAIN_PROMPT, self.quiz, self.questions = build_dynamic_prompt_from_quiz_data(quiz_data)
        # Keep lesson for backward compatibility
        self.lesson = self.quiz
        logger.info(f"MainAgent initialized for quiz '{self.quiz.get('name', 'Unknown')}' with dynamic prompt: %s", MAIN_PROMPT)
        self.conversation_log = []  # Track conversation for transcript
        self.current_question_number = 1  # Track current question number
        
        # Include quiz evaluation tool for quizzes
        tools = [set_questionnaire_answer, check_survey_complete, watchdog_survey_completion, evaluate_quiz_answer, ask_question]
        
        super().__init__(
            instructions=MAIN_PROMPT,
            tools=tools,
            tts=openai.TTS(voice="nova"),
        )

    async def on_enter(self) -> None:
        greeting = self.quiz.get("greeting") or "Hello, welcome to your quiz!"
        purpose_explanation = self.quiz.get("purpose_explanation", "Welcome! I am here to help you learn through an interactive quiz.")
        
        # Combine greeting and purpose explanation
        welcome_message = f"{greeting} {purpose_explanation}"
        await self.session.say(welcome_message, allow_interruptions=False)
        
        # Immediately ask the first question after greeting
        if self.questions and len(self.questions) > 0:
            first_question = self.questions[0]
            question_text = first_question.get("question_text", "")
            if question_text:
                # Ask the first question immediately with interruptions allowed
                # After saying the question, the agent will automatically listen for user response
                await self.session.say(f"Let's begin with the first question. {question_text}", allow_interruptions=True)
                # Log that we're now waiting for user response
                logger.info(f"First question asked, now waiting for user response: {question_text}")
                logger.info("Agent is now in listening mode - any user speech will be processed automatically")

        # Note: We'll send initial progress updates after session is fully initialized
        # The session context will be available in the tools once the session starts
        # The agent will automatically process user speech through STT and LLM after on_enter completes
        # The LiveKit Agent framework will automatically:
        # 1. Detect user speech via VAD (Voice Activity Detection)
        # 2. Transcribe it via STT (Speech-to-Text)
        # 3. Send the transcribed text to the LLM
        # 4. The LLM will process it according to the instructions in the prompt

def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()

# --- Legacy function (not used in quiz system) ---
# Kept for backward compatibility but not called in quiz flow
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
    """Submit a single answer to Supabase immediately after capture"""
    if not userdata.submission_id or userdata.submission_id == "fallback-attempt-id":
        logger.warning(f"Cannot submit answer for question {question_number} - invalid attempt ID")
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
        return False

    try:
        success = await quiz_client.create_answer(
            attempt_id=userdata.submission_id,
            question_id=question_id,
            user_answer=answer
        )
        
        if success:
            userdata.submitted_answers.add(question_number)
            logger.info(f"Successfully submitted answer for question {question_number} to Supabase")
            return True
        else:
            logger.error(f"Failed to submit answer for question {question_number}")
            return False
    except Exception as e:
        logger.error(f"Failed to submit answer for question {question_number} to Supabase: {e}")
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

    # Mark quiz as completed
    userdata.survey_completed = True
    logger.info(f"Quiz marked as completed - all {total_questions} answers submitted to Supabase")

    # Grade the attempt using the grade edge function
    if userdata.submission_id and userdata.submission_id != "fallback-attempt-id":
        try:
            logger.info(f"Calling grade function for attempt {userdata.submission_id}")
            grade_success = await quiz_client.grade_attempt(userdata.submission_id)
            
            if grade_success:
                logger.info(f"Successfully graded attempt {userdata.submission_id}")
            else:
                logger.warning(f"Failed to grade attempt {userdata.submission_id} - answers are saved but not graded")
        except Exception as e:
            logger.error(f"Error calling grade function: {e}")
            # Don't fail finalization if grading fails - answers are already saved

    # Count total surveys completed
    # statsd.increment("survey.completed")

    # Get attempt with all answers for recap
    attempt_data = None
    if userdata.submission_id and userdata.submission_id != "fallback-attempt-id":
        try:
            attempt_data = await quiz_client.get_attempt_with_answers(userdata.submission_id)
        except Exception as e:
            logger.error(f"Failed to get attempt data for recap: {e}")
    
    # Send recap to frontend
    await send_quiz_recap(ctx, userdata, attempt_data)
    
    # Send completion status
    await send_survey_status(ctx, "completed", "Quiz successfully completed and graded")

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
    """Submit a quiz answer to Supabase - grading will be done by edge function"""
    if not userdata.submission_id or userdata.submission_id == "fallback-submission-id":
        logger.warning(f"Cannot submit quiz answer for question {question_number} - invalid submission ID")
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
    
    # Store answer in Supabase
    try:
        success = await quiz_client.create_answer(
            attempt_id=userdata.submission_id,
            question_id=question_id,
            user_answer=answer
        )
        
        if success:
            # Store locally for tracking
            userdata.quiz_answers[question_number] = {
                "answer": answer,
                "question_id": question_id
            }
            userdata.submitted_answers.add(question_number)
            
            logger.info(f"Quiz answer for question {question_number} submitted to Supabase")
            return {
                "success": True,
                "is_correct": None,  # Will be determined by grade function
                "points": None,
                "feedback": "Answer saved. Evaluation will be done after completion."
            }
        else:
            logger.error(f"Failed to submit answer for question {question_number}")
            return {"success": False, "is_correct": False, "points": 0}
    except Exception as e:
        logger.error(f"Failed to submit quiz answer: {e}")
        return {"success": False, "is_correct": False, "points": 0}

@function_tool
async def evaluate_quiz_answer(
    question_number: Annotated[str, Field(description="The question number (e.g., '1', '2', '3')")],
    answer: Annotated[str, Field(description="The student's answer to evaluate")],
    ctx: RunContext_T
) -> str:
    """Evaluate a quiz answer and provide feedback. Use this for quiz questions."""
    userdata = ctx.userdata
    
    # Store answer in questionnaire_answers for tracking
    userdata.questionnaire_answers[question_number] = answer
    
    # Find question data to check correctness
    question_data = None
    correct_answer = None
    for question in userdata.questions:
        if question.get("question_order") == int(question_number):
            question_data = question
            correct_answer = question.get("correct_answer")
            break
    
    # Check if answer is correct locally (for immediate feedback)
    is_correct = False
    if correct_answer:
        is_correct = evaluate_answer_correctness(answer, str(correct_answer))
    
    # Submit and evaluate the answer
    result = await submit_quiz_answer(userdata, question_number, answer)
    
    # Update local tracking with correctness
    if question_number in userdata.quiz_answers:
        userdata.quiz_answers[question_number]["is_correct"] = is_correct
    else:
        userdata.quiz_answers[question_number] = {
            "answer": answer,
            "is_correct": is_correct
        }
    
    # Update correct count
    if is_correct:
        userdata.correct_count += 1
    
    # Find current question text
    current_question_text = None
    if question_data:
        current_question_text = question_data.get("question_text")
    
    # Send transcript update for participant answer
    await send_transcript_update(ctx, answer, "participant")
    
    # Send quiz feedback update to frontend with correctness info
    try:
        if hasattr(userdata, 'room') and userdata.room:
            feedback_data = {
                "type": "quiz_feedback",
                "question_number": question_number,
                "is_correct": is_correct,
                "user_answer": answer,
                "correct_answer": str(correct_answer) if correct_answer else None,
                "feedback": "Correct! Well done!" if is_correct else f"Not quite. The correct answer is: {correct_answer}" if correct_answer else "Answer recorded.",
                "points_earned": 1 if is_correct else 0,
                "total_points": len(userdata.questions),
                "correct_answers": userdata.correct_count,
                "timestamp": datetime.now().isoformat()
            }
            feedback_payload = json.dumps(feedback_data).encode('utf-8')
            await userdata.room.local_participant.publish_data(feedback_payload, reliable=True)
            logger.info(f"Quiz feedback sent for question {question_number}: correct={is_correct}")
    except Exception as e:
        logger.error(f"Failed to send quiz feedback: {e}")
    
    # Determine next question number
    next_question_num = str(int(question_number) + 1)
    next_question_text = None
    has_next_question = False
    
    # Check if there's a next question
    if int(question_number) < len(userdata.questions):
        for question in userdata.questions:
            if question.get("question_order") == int(next_question_num):
                next_question_text = question.get("question_text")
                has_next_question = True
                break
    
    # Send progress update - update to next question if available
    if has_next_question:
        await send_progress_update(
            ctx,
            current_question=next_question_num,
            last_answer=answer,
            current_question_text=next_question_text
        )
        logger.info(f"Answer for question {question_number} evaluated. Updated to question {next_question_num} (agent should be asking it now)")
    else:
        # No next question, keep current as the one just answered
        await send_progress_update(
            ctx,
            current_question=question_number,
            last_answer=answer,
            current_question_text=current_question_text
        )
    
    # Provide verbal feedback
    if is_correct:
        encouragement = "Excellent work! That's correct! " + (question_data.get("rationale", "") if question_data else "")
        userdata.performance_feedback.append(f"Q{question_number}: Correct - {encouragement}")
        return encouragement
    else:
        correct_answer_text = f" The correct answer is: {correct_answer}." if correct_answer else ""
        supportive = f"Good effort! Not quite right.{correct_answer_text} " + (question_data.get("rationale", "") if question_data else "Let's try the next one.")
        userdata.performance_feedback.append(f"Q{question_number}: Incorrect - {supportive}")
        return supportive

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
            # All questions in quizzes are quiz questions, so this shouldn't happen
            # But keep for safety
            result = await submit_quiz_answer(userdata, question_number, answer)
            if result["success"]:
                logger.info(f"Answer for question {question_number} submitted to Supabase immediately")
            else:
                logger.warning(f"Failed to submit answer for question {question_number} - will retry during finalization")
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

    # Determine next question number
    next_question_num = str(int(question_number) + 1)
    next_question_text = None
    has_next_question = False

    # Check if there's a next question
    if int(question_number) < len(userdata.questions):
        for question in userdata.questions:
            if question.get("question_order") == int(next_question_num):
                next_question_text = question.get("question_text")
                has_next_question = True
                break

    # Send progress update with current answer
    # If there's a next question, update to it (agent should be asking it soon)
    # This is a fallback in case the agent doesn't call ask_question
    if has_next_question:
        await send_progress_update(
            ctx,
            current_question=next_question_num,
            last_answer=answer,
            current_question_text=next_question_text
        )
        logger.info(f"Answer for question {question_number} received. Updated to question {next_question_num} (agent should be asking it now)")
    else:
        # No next question, keep current as the one just answered
        await send_progress_update(
            ctx,
            current_question=question_number,
            last_answer=answer,
            current_question_text=current_question_text
        )

    logger.info(f"Question {question_number} answer set: {answer}")
    logger.info(f"All questionnaire answers: {userdata.questionnaire_answers}")
    logger.info(f"Submitted answers: {userdata.submitted_answers}")

    if len(userdata.questionnaire_answers) == len(userdata.questions):
        await send_survey_status(ctx, "in_progress", "All questions answered, ready for completion")
        return f"Answer for question {question_number} has been saved to Supabase. Quiz complete - ready for finalization: {answer}"
    else:
        return f"Answer for question {question_number} has been saved to Supabase: {answer}"

@function_tool
async def check_survey_complete(ctx: RunContext_T) -> str:
    userdata = ctx.userdata
    total_questions = len(userdata.questions)
    answered_questions = len(userdata.questionnaire_answers)
    submitted_questions = len(userdata.submitted_answers)
    logger.info(f"Quiz completion check: {answered_questions}/{total_questions} questions answered, {submitted_questions}/{total_questions} submitted")

    if answered_questions == total_questions:
        # Use the new finalization with disconnect protection
        finalization_success = await finalize_survey_with_protection(userdata, ctx)

        if finalization_success:
            logger.info("Quiz completed - all data saved to Supabase with disconnect protection")

            # Verify all answers are in the database
            logger.info(f"Quiz attempt {userdata.submission_id} confirmed complete with {len(userdata.submitted_answers)} answers")

            # Automatically end the call after completion
            closing_message = userdata.lesson.get("closing", "Thank you for completing the quiz. Great job! Goodbye!")

            # Say the closing message first
            if hasattr(userdata, 'session') and userdata.session:
                await userdata.session.say(closing_message, allow_interruptions=False)

            # Send closing status and end the call
            await send_survey_status(ctx, "closing", "Quiz completed, ending call")
            logger.info("Quiz call ending - closing status sent")

            # End the session using the correct method
            if hasattr(userdata, 'session') and userdata.session:
                try:
                    await userdata.session.aclose()
                except Exception as e:
                    logger.warning(f"Error closing session: {e}")
                    # Session may already be closed or closing, which is fine

            return f"Quiz complete! Said closing message and ended the call."
        else:
            logger.error("Failed to finalize quiz - data may be lost")
            await send_survey_status(ctx, "error", "Failed to save quiz data")
            return f"Quiz completion failed - please try again."
    else:
        missing_questions = [str(question.get("question_order")) for question in userdata.questions if str(question.get("question_order")) not in userdata.questionnaire_answers]
        await send_survey_status(ctx, "in_progress", f"Quiz incomplete. Missing questions: {missing_questions}")
        return f"Quiz is not complete. {answered_questions}/{total_questions} questions answered. Missing questions: {missing_questions}"

@function_tool
async def ask_question(
    question_number: Annotated[str, Field(description="The question number being asked (e.g., '1', '2', '3')")],
    ctx: RunContext_T
) -> str:
    """Call this function when you are asking a question to the participant. This updates the frontend to show the correct question."""
    userdata = ctx.userdata
    
    # Find the question text for this question number
    question_text = None
    for question in userdata.questions:
        if question.get("question_order") == int(question_number):
            question_text = question.get("question_text")
            break
    
    if question_text:
        # Send progress update with the question being asked
        await send_progress_update(
            ctx,
            current_question=question_number,
            last_answer=None,  # No answer yet for this question
            current_question_text=question_text
        )
        logger.info(f"Question {question_number} asked - progress update sent: {question_text}")
        return f"Question {question_number} progress update sent to frontend"
    else:
        logger.warning(f"Question {question_number} not found in questions list")
        return f"Question {question_number} not found"

@function_tool
async def end_call(ctx: RunContext_T) -> str:
    """End the quiz call after sending closing status"""
    userdata = ctx.userdata

    # Send closing status to indicate the call is ending
    await send_survey_status(ctx, "closing", "Quiz completed, ending call")

    logger.info("Quiz call ending - closing status sent")

    return "Call ended successfully"

@function_tool
async def watchdog_survey_completion(ctx: RunContext_T) -> str:
    """Watchdog function to check quiz completion and retry submissions if needed"""
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
            logger.info("Watchdog: Successfully finalized quiz")
            return "Quiz finalized successfully via watchdog"
        else:
            logger.error("Watchdog: Failed to finalize quiz")
            return "Quiz finalization failed via watchdog"

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

    # Extract quiz link token from room name
    # Room name format: quiz-{token} or similar
    link_token = None
    if room_name.startswith("quiz-"):
        link_token = room_name.replace("quiz-", "")
    elif "-" in room_name:
        # Try to extract token from room name
        parts = room_name.split("-")
        if len(parts) >= 2:
            link_token = parts[-1]  # Last part as token
    else:
        link_token = room_name  # Use room name as token

    logger.info(f"Extracted quiz link token: {link_token}")

    quiz_data = None
    attempt_id = None

    # Check if attempt already exists for this link token
    existing_attempt = await quiz_client.get_existing_attempt(link_token)
    
    if existing_attempt:
        # Attempt already exists - resume
        logger.info(f"Existing attempt found: {existing_attempt['id']}")
        attempt_id = existing_attempt["id"]
        quiz_id = existing_attempt["quiz_id"]
        
        try:
            quiz_data = await quiz_client.get_quiz_by_id(quiz_id)
            logger.info(f"Loaded quiz data for existing attempt")
        except Exception as e:
            logger.error(f"Failed to load quiz data: {e}")
            quiz_data = None
    else:
        # New attempt - get quiz by link token
        try:
            logger.debug(f"Getting quiz for link token: {link_token}")
            quiz_data = await quiz_client.get_quiz_by_link_token(link_token)
            
            if not quiz_data:
                logger.error(f"Quiz not found for link token: {link_token}")
                # Fallback
                quiz_data = {
                    "quiz": {
                        "id": "fallback",
                        "name": "Default Quiz",
                        "intro_prompt": "You are a friendly and encouraging AI voice teacher.",
                        "purpose_explanation": "Welcome! I'm here to help you learn.",
                        "greeting": "Hello, welcome to your quiz!",
                        "closing": "Thank you for completing the quiz. Great job!"
                    },
                    "questions": []
                }
                attempt_id = "fallback-attempt-id"
            else:
                # Create new attempt
                quiz_id = quiz_data["quiz"]["id"]
                attempt_id = await quiz_client.create_attempt(
                    quiz_id=quiz_id,
                    user_id=None,  # Anonymous for link-based quizzes
                    link_token=link_token
                )
                
                if attempt_id:
                    logger.info(f"Created new attempt: {attempt_id}")
                else:
                    logger.error("Failed to create attempt")
                    attempt_id = "fallback-attempt-id"
        except Exception as e:
            logger.error(f"Failed to get quiz or create attempt: {e}")
            quiz_data = {
                "quiz": {
                    "id": "fallback",
                    "name": "Default Quiz",
                    "intro_prompt": "You are a friendly and encouraging AI voice teacher.",
                    "purpose_explanation": "Welcome! I'm here to help you learn.",
                    "greeting": "Hello, welcome to your quiz!",
                    "closing": "Thank you for completing the quiz. Great job!"
                },
                "questions": []
            }
            attempt_id = "fallback-attempt-id"

    # Initialize user data
    userdata = UserData()
    userdata.customer_phone = phone_number if phone_number else None
    userdata.customer_email = email if email else None

    # Create main agent with quiz data from Supabase
    userdata.agents.update({
        "main_agent": MainAgent(quiz_data),
    })
    userdata.questions = userdata.agents["main_agent"].questions
    
    # Store quiz dict in userdata (keep lesson for backward compatibility)
    userdata.lesson = quiz_data.get("quiz", {})
    userdata.campaign = userdata.lesson  # Keep for backward compatibility
    
    userdata.submission_id = attempt_id  # Set submission_id to attempt_id
    userdata.room = ctx.room  # Store room reference for data publishing

    # For backward compatibility, also set call_id to submission_id
    userdata.call_id = attempt_id
    
    # Set lesson mode (always true for quizzes)
    userdata.is_lesson_mode = True
    logger.info("Quiz mode enabled - answers will be saved to Supabase")
    # Initialize performance tracking
    userdata.total_points_possible = sum(q.get("points", 1) for q in userdata.questions if q.get("is_quiz_question", True))

    # S3 recording can be added later if needed
    userdata.s3_recording_url = None

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
        # Log room participants before starting session
        logger.info(f"Room participants before session start: {[p.identity for p in ctx.room.remote_participants.values()]}")
        logger.info(f"Local participant: {ctx.room.local_participant.identity}")
        
        # Check for audio tracks from remote participants (simplified - just log all tracks)
        for participant in ctx.room.remote_participants.values():
            all_tracks = list(participant.track_publications.values())
            logger.info(f"Participant {participant.identity} has {len(all_tracks)} track publication(s)")
            for track_pub in all_tracks:
                track_name = getattr(track_pub, 'track_name', 'unknown')
                track_kind = getattr(track_pub, 'kind', None)
                subscribed = getattr(track_pub, 'subscribed', False)
                track = getattr(track_pub, 'track', None)
                muted = getattr(track, 'muted', None) if track else None
                logger.info(f"  Track: {track_name}, kind: {track_kind}, subscribed: {subscribed}, muted: {muted}")
        
        await session.start(
            agent=userdata.agents["main_agent"],
            room=ctx.room,
            room_input_options=RoomInputOptions(
                noise_cancellation=noise_cancellation.BVC(),
            ),
        )
        logger.info("Session started successfully - agent is now listening for user audio")
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

    # No cleanup needed for Supabase client - it's a singleton

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