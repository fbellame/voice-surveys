import logging
import json
from datetime import datetime
from typing import Annotated

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
    get_campaign_by_uri_and_token, record_survey_submission_api, record_answer_api,
    update_submission_s3_url_api, get_existing_submission_api, get_existing_answers_api,
    cleanup_api_client
)

load_dotenv()

# Set up maximum debug logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("futures_survey_assistant")
logger.setLevel(logging.DEBUG)

# Set all related loggers to DEBUG level
logging.getLogger("futures_survey_api").setLevel(logging.DEBUG)
logging.getLogger("livekit.agents").setLevel(logging.INFO)
logging.getLogger("livekit").setLevel(logging.INFO)
logging.getLogger("aiohttp").setLevel(logging.INFO)
logging.getLogger("asyncio").setLevel(logging.INFO)

# Suppress only the most verbose logs
logging.getLogger("hpack.hpack").setLevel(logging.ERROR)
    
RunContext_T = RunContext[UserData]

# API-based operations - all database calls now go through the API client

def build_dynamic_prompt_from_campaign_data(campaign_data):
    """Build dynamic prompt from campaign data received from API."""
    logger.debug(f"Building dynamic prompt from campaign data: {campaign_data}")
    
    campaign = campaign_data.get("campaign", {})
    questions = campaign_data.get("questions", [])
    
    logger.debug(f"Campaign data: {campaign}")
    logger.debug(f"Questions data: {questions}")
    logger.debug(f"Number of questions: {len(questions)}")
    
    current_time = datetime.now().strftime('%A, %B %d, %Y at %I:%M %p')
    questions_section = ""
    for i, question in enumerate(questions):
        qid = question.get("id")
        qtext = question.get("question_text")
        qorder = question.get("question_order")
        logger.debug(f"Processing question {i+1}: id={qid}, order={qorder}, text='{qtext}'")
        questions_section += f"\n{qorder}) Question {qorder}:\n   \"{qtext}\"\n"
    
    prompt = f"""
{campaign.get('intro_prompt', '')}
Current date and time: {current_time}

LANGUAGE POLICY
Detect the participant's first reply.
Do not switch languages once the conversation has started, even if the participant does.
Never use special characters such as %, $, #, or *.

SURVEY FLOW (ask only one question at a time)

1) Briefly explain purpose:
   \"{campaign.get('purpose_explanation', '')}\"
{questions_section}
{len(questions) + 3}) Completion check:
   After the recap, call check_survey_complete to ensure all questions were answered.

{len(questions) + 4}) Closing:
   Survey will automatically end when check_survey_complete confirms all questions are answered.

GENERAL GUIDELINES
Ask only one question at a time.
Respond in clear, complete sentences.
If the participant provides unexpected information, politely steer them back to the current question.
Do not provide medical or technical advice; clarify that your role is limited to conducting this survey.
If the participant asks for information outside your scope, respond succinctly that you can only administer the survey.
"""
    return prompt, campaign, questions

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
    def __init__(self, campaign_data) -> None:
        MAIN_PROMPT, self.campaign, self.questions = build_dynamic_prompt_from_campaign_data(campaign_data)
        logger.info(f"MainAgent initialized for campaign '{self.campaign.get('name', 'Unknown')}' with dynamic prompt: %s", MAIN_PROMPT)
        self.conversation_log = []  # Track conversation for transcript
        super().__init__(
            instructions=MAIN_PROMPT,
            tools=[set_questionnaire_answer, check_survey_complete],
            tts=openai.TTS(voice="nova"),
        )
    
    async def on_enter(self) -> None:
        greeting = self.campaign["greeting"] or "Hello, welcome to our survey."
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
    
@function_tool    
async def set_questionnaire_answer(
    question_number: Annotated[str, Field(description="The question number (e.g., '1', '2', '3')")],
    answer: Annotated[str, Field(description="The answer")], 
    ctx: RunContext_T
) -> str:
    userdata = ctx.userdata
    userdata.questionnaire_answers[question_number] = answer
    
    # Find current question text
    current_question_text = None
    for q_id, q_text, q_order in userdata.questions:
        if q_order == int(question_number):
            current_question_text = q_text
            break
    
    # Send transcript update for participant answer
    await send_transcript_update(ctx, answer, "participant")
    
    # Determine next question
    next_question_num = str(int(question_number) + 1)
    next_question_text = None
    
    if int(question_number) < len(userdata.questions):
        for q_id, q_text, q_order in userdata.questions:
            if q_order == int(next_question_num):
                next_question_text = q_text
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
    
    if len(userdata.questionnaire_answers) == len(userdata.questions):
        await send_survey_status(ctx, "in_progress", "All questions answered, ready for completion")
        return f"Answer for question {question_number} has been saved successfully. Survey complete - ready for finalization: {answer}"
    else:
        return f"Answer for question {question_number} has been saved successfully: {answer}"

@function_tool
async def check_survey_complete(ctx: RunContext_T) -> str:
    userdata = ctx.userdata
    total_questions = len(userdata.questions)
    answered_questions = len(userdata.questionnaire_answers)
    logger.info(f"Survey completion check: {answered_questions}/{total_questions} questions answered")
    
    if answered_questions == total_questions:
        # Save complete survey to API
        await save_userdata_to_api(userdata, userdata.campaign["id"], userdata.submission_id)
        logger.info("Survey completed - all data saved to API")
        
        # Send completion status
        await send_survey_status(ctx, "completed", "Survey successfully completed and saved via API")
        
        # Send final progress update
        await send_progress_update(ctx, current_question=None, last_answer=None)
        
        # Automatically end the call after completion
        closing_message = userdata.campaign.get("closing", "Thank you for completing the survey. Goodbye!")
        
        # Say the closing message first
        if hasattr(userdata, 'session') and userdata.session:
            await userdata.session.say(closing_message, allow_interruptions=False)
        
        # Send closing status and end the call
        await send_survey_status(ctx, "closing", "Survey completed, ending call")
        logger.info("Survey call ending - closing status sent")
        
        # End the session using the correct method
        if hasattr(userdata, 'session') and userdata.session:
            try:
                await userdata.session.aclose()
            except Exception as e:
                logger.warning(f"Error closing session: {e}")
                # Session may already be closed or closing, which is fine
        
        return f"Survey complete! Said closing message and ended the call."
    else:
        missing_questions = [str(q[2]) for q in userdata.questions if str(q[2]) not in userdata.questionnaire_answers]
        await send_survey_status(ctx, "in_progress", f"Survey incomplete. Missing questions: {missing_questions}")
        return f"Survey is not complete. {answered_questions}/{total_questions} questions answered. Missing questions: {missing_questions}"

@function_tool
async def end_call(ctx: RunContext_T) -> str:
    """End the survey call after sending closing status"""
    userdata = ctx.userdata
    
    # Send closing status to indicate the call is ending
    await send_survey_status(ctx, "closing", "Survey completed, ending call")
    
    logger.info("Survey call ending - closing status sent")
        
    return "Call ended successfully"

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
    
    # Check if survey submission already exists for this room
    existing_submission = await get_existing_submission_api(room_name)
    if existing_submission:
        logger.info(f"Survey submission already exists for room {room_name} (ID: {existing_submission['id']})")
        logger.debug(f"Existing submission data: {existing_submission}")
        submission_id = existing_submission['id']
        campaign_id = existing_submission['campaign_id']
        
        # Get campaign details from API using the campaign URI and link token
        # Use the link_token stored in the database
        campaign_id = existing_submission.get('campaign_id')
        link_token = existing_submission.get('link_token')
        
        # Get campaign_uri from the campaign data in the submission response
        campaign_data = existing_submission.get('campaign', {})
        campaign_uri = campaign_data.get('campaign_uri') or 'default'
        
        # Ensure we have a link_token - it should be in the database
        if not link_token:
            logger.error(f"No link_token found in existing submission for room {room_name}")
            # Fallback to extracting from room name (should not happen in normal operation)
            if "-" in room_name:
                base_pattern = room_name.rsplit("-", 1)[0]
                link_token = base_pattern
            else:
                link_token = room_name
        
        try:
            logger.debug(f"Getting campaign data for URI: {campaign_uri}, token: {link_token}")
            campaign_data = await get_campaign_by_uri_and_token(campaign_uri, link_token)
            logger.debug(f"Campaign data received: {campaign_data}")
        except Exception as e:
            logger.error(f"Failed to get campaign data from API: {e}")
            # Fallback to basic campaign info from existing submission
            campaign_data = {
                "campaign": {
                    "id": campaign_id,
                    "name": "Fallback Campaign",
                    "intro_prompt": "You are conducting a survey.",
                    "purpose_explanation": "Thank you for participating.",
                    "greeting": "Hello, welcome to our survey.",
                    "closing": "Thank you for completing this survey."
                },
                "questions": []
            }
    else:
        # For new submissions, we need to determine the campaign and create a submission
        # Extract campaign URI and link token from room name
        
        # Parse room name to extract campaign_uri and link_token
        # Room name format: {room_pattern}{random_suffix}
        # Example: "survey-api-test-5564" -> campaign_uri: "survey-api-test", link_token: "survey-api-test"
        
        # Extract campaign_uri from room name by removing the random suffix
        # The room pattern ends with "-", so we split on the last "-" and take everything before it
        if "-" in room_name:
            # Remove the random suffix (everything after the last "-")
            base_pattern = room_name.rsplit("-", 1)[0]
            campaign_uri = base_pattern
            link_token = base_pattern  # Use the same base pattern as the link token
        else:
            # Fallback if room name doesn't follow expected pattern
            campaign_uri = "default"
            link_token = room_name
        
        try:
            # Get campaign details from API
            campaign_data = await get_campaign_by_uri_and_token(campaign_uri, link_token)
            campaign = campaign_data.get("campaign", {})
            
            # Create new survey submission via API
            link_type = "phone" if phone_number else "email" if email else "generic"
            submission_response = await record_survey_submission_api(
                campaign_id=campaign["id"],
                link_token=link_token,
                link_type=link_type,
                room_name=room_name,
                s3_recording_url=None
            )
            submission_id = submission_response
            logger.info(f"New survey submission created via API with id: {submission_id}")
            
        except Exception as e:
            logger.error(f"Failed to create submission via API: {e}")
            # Fallback to basic campaign data
            campaign_data = {
                "campaign": {
                    "id": 1,
                    "name": "Default Campaign",
                    "intro_prompt": "You are conducting a survey.",
                    "purpose_explanation": "Thank you for participating.",
                    "greeting": "Hello, welcome to our survey.",
                    "closing": "Thank you for completing this survey."
                },
                "questions": []
            }
            submission_id = "fallback-submission-id"
    
    # Initialize user data
    userdata = UserData()
    userdata.customer_phone = phone_number if phone_number else None
    userdata.customer_email = email if email else None
    
    # Create main agent with campaign data from API
    userdata.agents.update({
        "main_agent": MainAgent(campaign_data),
    })
    userdata.questions = userdata.agents["main_agent"].questions
    userdata.campaign = campaign_data.get("campaign", {})  # Store campaign dict in userdata
    userdata.submission_id = submission_id  # Set submission_id instead of call_id
    userdata.room = ctx.room  # Store room reference for data publishing
    
    # For backward compatibility, also set call_id to submission_id
    userdata.call_id = submission_id
    
    # Start S3 voice recording only if not already started
    if not existing_submission or not existing_submission.get('s3_recording_url'):
        recording_success = await start_s3_recording(room_name, userdata)
        if recording_success:
            logger.info("S3 Recording started successfully")
            # Update the survey submission with the recording URL via API (skip for fallback submission ID)
            if hasattr(userdata, 's3_recording_url') and userdata.s3_recording_url and submission_id != "fallback-submission-id":
                success = await update_submission_s3_url_api(submission_id, userdata.s3_recording_url)
                if not success:
                    logger.warning(f"Failed to update S3 recording URL via API for submission {submission_id}")
            elif hasattr(userdata, 's3_recording_url') and userdata.s3_recording_url and submission_id == "fallback-submission-id":
                logger.warning("Cannot update S3 recording URL for fallback submission ID")
        else:
            logger.warning("S3 Recording failed, continuing without recording")
            userdata.s3_recording_url = None  # Explicitly set to None if failed
    else:
        logger.info("S3 Recording already exists for this survey submission")
        userdata.s3_recording_url = existing_submission.get('s3_recording_url')
    
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
    await session.start(
        agent=userdata.agents["main_agent"],
        room=ctx.room,
        room_input_options=RoomInputOptions(
            noise_cancellation=noise_cancellation.BVC(),
        ),
    )
    
    # Send the first question to the frontend after session starts
    # Send directly using userdata.room without creating a RunContext
    if userdata.questions:
        first_question = userdata.questions[0]  # (q_id, q_text, q_order)
        
        # Send progress update with first question
        progress_data = {
            "type": "survey_progress",
            "current_question_number": "1",
            "current_question_text": first_question[1],  # q_text
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
                
                logger.info(f"First question sent to frontend: {first_question[1]}")
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
    #agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm, agent_name="alex-telephony-agent"))
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm))