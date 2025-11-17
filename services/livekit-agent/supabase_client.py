"""
Supabase client for direct database access.
Replaces the API client to work directly with local Supabase instance.
"""
import os
import logging
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv
from supabase import create_client, Client

# Set up logger
logger = logging.getLogger("supabase_client")
logger.setLevel(logging.INFO)

# Load environment variables
load_dotenv()

# Supabase configuration - defaults to local instance
SUPABASE_URL = os.getenv("SUPABASE_URL", "http://127.0.0.1:54321")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError("SUPABASE_SERVICE_ROLE_KEY must be set in environment variables or .env file")

# Create Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

logger.info(f"Initialized Supabase client with URL: {SUPABASE_URL}")


class QuizSupabaseClient:
    """Client for interacting with Supabase quiz system"""
    
    def __init__(self, client: Client = None):
        self.client = client or supabase
        logger.info("QuizSupabaseClient initialized")
    
    async def get_quiz_by_link_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Get quiz details by quiz link token"""
        try:
            import asyncio
            # Run synchronous Supabase call in executor to avoid blocking
            loop = asyncio.get_event_loop()
            
            # First, get the quiz link
            link_response = await loop.run_in_executor(
                None,
                lambda: self.client.table("quiz_links").select(
                    "id, quiz_id, name, is_active, expires_at"
                ).eq("unique_token", token).eq("is_active", True).single().execute()
            )
            
            if not link_response.data:
                logger.error(f"Quiz link not found or inactive: {token}")
                return None
            
            link_data = link_response.data
            quiz_id = link_data["quiz_id"]
            
            # Check if link has expired
            if link_data.get("expires_at"):
                from datetime import datetime
                expires_at = datetime.fromisoformat(link_data["expires_at"].replace("Z", "+00:00"))
                if datetime.now(expires_at.tzinfo) > expires_at:
                    logger.error(f"Quiz link has expired: {token}")
                    return None
            
            # Get quiz with questions (simplified query)
            quiz_response = await loop.run_in_executor(
                None,
                lambda: self.client.table("quizzes").select(
                    "id, title, document_id, questions:questions(id, type, prompt, options, correct_answer, rationale, bloom_level)"
                ).eq("id", quiz_id).single().execute()
            )
            
            if not quiz_response.data:
                logger.error(f"Quiz not found: {quiz_id}")
                return None
            
            quiz_data = quiz_response.data
            questions = quiz_data.get("questions", [])
            
            # Get document title if needed (optional)
            document_title = "document"
            if quiz_data.get("document_id"):
                try:
                    doc_response = await loop.run_in_executor(
                        None,
                        lambda: self.client.table("documents").select("title").eq("id", quiz_data["document_id"]).single().execute()
                    )
                    if doc_response.data:
                        document_title = doc_response.data.get("title", "document")
                except Exception as e:
                    logger.warning(f"Could not fetch document title: {e}")
            
            # Format questions to match expected structure
            formatted_questions = []
            for idx, q in enumerate(questions, start=1):
                formatted_questions.append({
                    "id": q["id"],
                    "question_order": idx,
                    "question_text": q["prompt"],
                    "type": q["type"],
                    "options": q.get("options"),
                    "correct_answer": q.get("correct_answer"),
                    "rationale": q.get("rationale"),
                    "is_quiz_question": True,  # All questions in quizzes are quiz questions
                    "points": 1  # Default points, can be extended later
                })
            
            return {
                "quiz": {
                    "id": quiz_data["id"],
                    "title": quiz_data["title"],
                    "name": quiz_data["title"],
                    "description": f"Quiz from {document_title}",
                    "intro_prompt": "You are a friendly and encouraging AI voice teacher helping a student learn through interactive quizzes.",
                    "purpose_explanation": "Welcome! I am here to help you learn through an interactive quiz.",
                    "greeting": f"Hello! Welcome to the quiz: {quiz_data['title']}. Let's begin!",
                    "closing": "Thank you for completing the quiz! Great job!",
                },
                "questions": formatted_questions,
                "link_id": link_data["id"],
                "link_token": token
            }
        except Exception as e:
            logger.error(f"Failed to get quiz by link token: {e}")
            return None
    
    async def get_quiz_by_id(self, quiz_id: str) -> Optional[Dict[str, Any]]:
        """Get quiz details by quiz ID"""
        try:
            import asyncio
            loop = asyncio.get_event_loop()
            quiz_response = await loop.run_in_executor(
                None,
                lambda: self.client.table("quizzes").select(
                    "id, title, document_id, questions:questions(id, type, prompt, options, correct_answer, rationale, bloom_level)"
                ).eq("id", quiz_id).single().execute()
            )
            
            if not quiz_response.data:
                logger.error(f"Quiz not found: {quiz_id}")
                return None
            
            quiz_data = quiz_response.data
            questions = quiz_data.get("questions", [])
            
            # Get document title if needed (optional)
            document_title = "document"
            if quiz_data.get("document_id"):
                try:
                    doc_response = await loop.run_in_executor(
                        None,
                        lambda: self.client.table("documents").select("title").eq("id", quiz_data["document_id"]).single().execute()
                    )
                    if doc_response.data:
                        document_title = doc_response.data.get("title", "document")
                except Exception as e:
                    logger.warning(f"Could not fetch document title: {e}")
            
            # Format questions
            formatted_questions = []
            for idx, q in enumerate(questions, start=1):
                formatted_questions.append({
                    "id": q["id"],
                    "question_order": idx,
                    "question_text": q["prompt"],
                    "type": q["type"],
                    "options": q.get("options"),
                    "correct_answer": q.get("correct_answer"),
                    "rationale": q.get("rationale"),
                    "is_quiz_question": True,
                    "points": 1
                })
            
            return {
                "quiz": {
                    "id": quiz_data["id"],
                    "title": quiz_data["title"],
                    "name": quiz_data["title"],
                    "description": f"Quiz from {document_title}",
                    "intro_prompt": "You are a friendly and encouraging AI voice teacher helping a student learn through interactive quizzes.",
                    "purpose_explanation": "Welcome! I am here to help you learn through an interactive quiz.",
                    "greeting": f"Hello! Welcome to the quiz: {quiz_data['title']}. Let's begin!",
                    "closing": "Thank you for completing the quiz! Great job!",
                },
                "questions": formatted_questions
            }
        except Exception as e:
            logger.error(f"Failed to get quiz by ID: {e}")
            return None
    
    async def create_attempt(self, quiz_id: str, user_id: Optional[str] = None, 
                           assignment_id: Optional[str] = None, 
                           link_token: Optional[str] = None) -> Optional[str]:
        """Create a new quiz attempt"""
        try:
            import asyncio
            loop = asyncio.get_event_loop()
            attempt_data = {
                "quiz_id": quiz_id,
                "user_id": user_id,
                "assignment_id": assignment_id,
                "link_token": link_token,
                "is_anonymous": user_id is None
            }
            
            response = await loop.run_in_executor(
                None,
                lambda: self.client.table("attempts").insert(attempt_data).select("id").execute()
            )
            
            if response.data and len(response.data) > 0:
                attempt_id = response.data[0]["id"]
                logger.info(f"Created attempt {attempt_id} for quiz {quiz_id}")
                return attempt_id
            else:
                logger.error("Failed to create attempt - no ID returned")
                return None
        except Exception as e:
            logger.error(f"Failed to create attempt: {e}")
            return None
    
    async def create_answer(self, attempt_id: str, question_id: str, user_answer: Any) -> bool:
        """Create an answer for a question in an attempt"""
        try:
            import asyncio
            loop = asyncio.get_event_loop()
            answer_data = {
                "attempt_id": attempt_id,
                "question_id": question_id,
                "user_answer": user_answer
            }
            
            response = await loop.run_in_executor(
                None,
                lambda: self.client.table("answers").insert(answer_data).execute()
            )
            
            if response.data:
                logger.info(f"Created answer for question {question_id} in attempt {attempt_id}")
                return True
            else:
                logger.error("Failed to create answer - no data returned")
                return False
        except Exception as e:
            logger.error(f"Failed to create answer: {e}")
            return False
    
    async def get_existing_attempt(self, link_token: str) -> Optional[Dict[str, Any]]:
        """Get existing attempt by link token"""
        try:
            import asyncio
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.client.table("attempts").select(
                    "id, quiz_id, user_id, started_at, finished_at, score_numeric"
                ).eq("link_token", link_token).is_("finished_at", "null").order("started_at", desc=True).limit(1).execute()
            )
            
            if response.data and len(response.data) > 0:
                return response.data[0]
            return None
        except Exception as e:
            logger.error(f"Failed to get existing attempt: {e}")
            return None
    
    async def grade_attempt(self, attempt_id: str) -> bool:
        """Call the grade edge function to grade an attempt"""
        try:
            import aiohttp
            
            grade_url = f"{SUPABASE_URL}/functions/v1/grade"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
            }
            payload = {"attempt_id": attempt_id}
            
            async with aiohttp.ClientSession() as session:
                async with session.post(grade_url, json=payload, headers=headers) as response:
                    if response.status == 200:
                        result = await response.json()
                        logger.info(f"Graded attempt {attempt_id}: {result}")
                        return True
                    else:
                        error_text = await response.text()
                        logger.error(f"Failed to grade attempt {attempt_id}: {response.status} - {error_text}")
                        return False
        except Exception as e:
            logger.error(f"Error calling grade function: {e}")
            return False
    
    async def get_attempt_with_answers(self, attempt_id: str) -> Optional[Dict[str, Any]]:
        """Get attempt with all answers"""
        try:
            import asyncio
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.client.table("attempts").select(
                    """
                    *,
                    quiz:quizzes(*),
                    answers(
                        *,
                        question:questions(*)
                    )
                    """
                ).eq("id", attempt_id).single().execute()
            )
            
            if response.data:
                return response.data
            return None
        except Exception as e:
            logger.error(f"Failed to get attempt with answers: {e}")
            return None


# Global client instance
quiz_client = QuizSupabaseClient()

