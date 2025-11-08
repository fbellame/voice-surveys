import os
import logging
import aiohttp
from aiohttp import ClientResponseError
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv

# Set up logger
logger = logging.getLogger("futures_survey_api")
logger.setLevel(logging.INFO)

# Load environment variables
load_dotenv()

# API configuration from environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL")
API_KEY = os.getenv("SUPABASE_KEY")  # Use SUPABASE_KEY to store the anon key value

if not SUPABASE_URL:
    raise ValueError("SUPABASE_URL must be set in environment variables or .env file")

if not API_KEY:
    raise ValueError("SUPABASE_KEY must be set in environment variables or .env file")

# Construct the API base URL for Supabase Edge Functions
API_BASE_URL = f"{SUPABASE_URL}/functions/v1/survey-api"

class SurveyAPIClient:
    """Client for interacting with the Voice Survey Hub API"""
    
    def __init__(self, base_url: str = None, api_key: str = None):
        self.base_url = base_url or API_BASE_URL
        self.api_key = api_key or API_KEY
        self.session = None
        logger.info(f"Initialized API client with base URL: {self.base_url}")
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session"""
        if self.session is None or self.session.closed:
            headers = {
                "Content-Type": "application/json",
            }
            # Add Authorization header only if API key is provided
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"
            
            self.session = aiohttp.ClientSession(headers=headers)
        return self.session
    
    async def close(self):
        """Close the aiohttp session"""
        if self.session and not self.session.closed:
            await self.session.close()
    
    async def _make_request(self, method: str, endpoint: str, data: Dict = None, params: Dict = None) -> Dict:
        """Make HTTP request to the API"""
        session = await self._get_session()
        url = f"{self.base_url}{endpoint}"
        
        logger.debug(f"Making {method} request to: {url}")
        logger.debug(f"Headers: {session._default_headers}")
        logger.debug(f"Params: {params}")
        logger.debug(f"Data: {data}")
        
        try:
            if method.upper() == "GET":
                async with session.get(url, params=params) as response:
                    logger.debug(f"Response status: {response.status}")
                    logger.debug(f"Response headers: {dict(response.headers)}")
                    response.raise_for_status()
                    result = await response.json()
                    logger.debug(f"Response body: {result}")
                    return result
            elif method.upper() == "POST":
                async with session.post(url, json=data, params=params) as response:
                    logger.debug(f"Response status: {response.status}")
                    logger.debug(f"Response headers: {dict(response.headers)}")
                    response.raise_for_status()
                    result = await response.json()
                    logger.debug(f"Response body: {result}")
                    return result
            elif method.upper() == "PUT":
                async with session.put(url, json=data, params=params) as response:
                    logger.debug(f"Response status: {response.status}")
                    logger.debug(f"Response headers: {dict(response.headers)}")
                    response.raise_for_status()
                    result = await response.json()
                    logger.debug(f"Response body: {result}")
                    return result
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
        except aiohttp.ClientError as e:
            logger.error(f"API request failed: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error in API request: {e}")
            raise
    
    async def get_campaign_details(self, campaign_uri: str, link_token: str) -> Dict[str, Any]:
        """Get campaign details and questions via API"""
        try:
            endpoint = f"/campaigns/{campaign_uri}/details"
            params = {"token": link_token}
            
            logger.debug(f"Making API request to: {self.base_url}{endpoint}")
            logger.debug(f"With params: {params}")
            
            response = await self._make_request("GET", endpoint, params=params)
            logger.debug(f"Raw API response: {response}")
            logger.info(f"Retrieved campaign details for {campaign_uri}")
            
            # Convert the Edge Function response format to match what the main.py expects
            result = {
                "campaign": {
                    "id": response.get("id"),
                    "name": response.get("name"),
                    "description": response.get("description"),
                    "campaign_uri": response.get("campaign_uri"),
                    "intro_prompt": response.get("intro_prompt", "You are conducting a survey."),
                    "purpose_explanation": response.get("purpose_explanation", "Thank you for participating."),
                    "greeting": response.get("greeting", "Hello, welcome to our survey."),
                    "closing": response.get("closing", "Thank you for completing this survey.")
                },
                "questions": response.get("questions", [])
            }
            
            logger.debug(f"Processed campaign data: {result}")
            logger.debug(f"Number of questions in response: {len(result.get('questions', []))}")
            
            return result
        except Exception as e:
            logger.error(f"Failed to get campaign details: {e}")
            raise
    
    async def get_campaign_details_by_id(self, campaign_id: int) -> Dict[str, Any]:
        """Get campaign details and questions via API using campaign ID"""
        try:
            endpoint = f"/campaigns/{campaign_id}/details-by-id"
            
            logger.debug(f"Making API request to: {self.base_url}{endpoint}")
            
            response = await self._make_request("GET", endpoint)
            logger.debug(f"Raw API response: {response}")
            logger.info(f"Retrieved campaign details for ID {campaign_id}")
            
            # Convert the Edge Function response format to match what the main.py expects
            result = {
                "campaign": {
                    "id": response.get("id"),
                    "name": response.get("name"),
                    "description": response.get("description"),
                    "campaign_uri": response.get("campaign_uri"),
                    "intro_prompt": response.get("intro_prompt", "You are conducting a survey."),
                    "purpose_explanation": response.get("purpose_explanation", "Thank you for participating."),
                    "greeting": response.get("greeting", "Hello, welcome to our survey."),
                    "closing": response.get("closing", "Thank you for completing this survey.")
                },
                "questions": response.get("questions", [])
            }
            
            logger.debug(f"Processed campaign data: {result}")
            logger.debug(f"Number of questions in response: {len(result.get('questions', []))}")
            
            return result
        except Exception as e:
            logger.error(f"Failed to get campaign details by ID: {e}")
            raise
    
    async def create_submission(self, campaign_id: int, link_token: str, link_type: str, 
                               room_name: str = None, s3_recording_url: str = None, 
                               call_timestamp: str = None) -> Dict[str, Any]:
        """Create a new survey submission via API"""
        try:
            endpoint = "/submissions"
            data = {
                "campaign_id": campaign_id,
                "link_token": link_token,
                "link_type": link_type
            }
            
            # Add optional fields
            if room_name:
                data["room_name"] = room_name
            if s3_recording_url:
                data["s3_recording_url"] = s3_recording_url
            if call_timestamp:
                data["call_timestamp"] = call_timestamp
            
            response = await self._make_request("POST", endpoint, data=data)
            logger.info(f"Created submission with ID: {response.get('submission_id')}")
            return response
        except Exception as e:
            logger.error(f"Failed to create submission: {e}")
            raise
    
    async def submit_answers(self, submission_id: str, answers: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Submit answers for a survey submission via API"""
        try:
            endpoint = f"/submissions/{submission_id}/answers"
            data = {"answers": answers}
            
            response = await self._make_request("POST", endpoint, data=data)
            logger.info(f"Submitted {len(answers)} answers for submission {submission_id}")
            return response
        except ClientResponseError as e:
            if e.status == 404:
                logger.warning(f"Submission {submission_id} not found in database - cannot submit answers")
                raise
            else:
                logger.error(f"Failed to submit answers: {e}")
                raise
        except Exception as e:
            logger.error(f"Failed to submit answers: {e}")
            raise
    
    async def update_submission_s3_url(self, submission_id: str, s3_recording_url: str) -> Dict[str, Any]:
        """Update the S3 recording URL for a submission via API"""
        try:
            endpoint = f"/submissions/{submission_id}"
            data = {"s3_recording_url": s3_recording_url}
            
            response = await self._make_request("PUT", endpoint, data=data)
            logger.info(f"Updated submission {submission_id} with S3 URL")
            return response
        except ClientResponseError as e:
            if e.status == 404:
                logger.warning(f"Submission {submission_id} not found in database - cannot update S3 URL")
                raise
            else:
                logger.error(f"Failed to update submission S3 URL: {e}")
                raise
        except Exception as e:
            logger.error(f"Failed to update submission S3 URL: {e}")
            raise
    
    async def update_lesson_submission_s3_url(self, submission_id: str, s3_recording_url: str) -> Dict[str, Any]:
        """Update the S3 recording URL for a lesson submission via API"""
        try:
            endpoint = f"/lesson-submissions/{submission_id}"
            data = {"s3_recording_url": s3_recording_url}
            
            response = await self._make_request("PUT", endpoint, data=data)
            logger.info(f"Updated lesson submission {submission_id} with S3 URL")
            return response
        except ClientResponseError as e:
            if e.status == 404:
                logger.warning(f"Lesson submission {submission_id} not found in database - cannot update S3 URL")
                raise
            else:
                logger.error(f"Failed to update lesson submission S3 URL: {e}")
                raise
        except Exception as e:
            logger.error(f"Failed to update lesson submission S3 URL: {e}")
            raise
    
    async def get_existing_submission(self, room_name: str) -> Optional[Dict[str, Any]]:
        """Get existing submission by room name via API"""
        try:
            endpoint = "/submissions"
            params = {"room_name": room_name}
            
            response = await self._make_request("GET", endpoint, params=params)
            
            if response.get("submissions") and len(response["submissions"]) > 0:
                logger.info(f"Found existing submission for room {room_name}")
                return response["submissions"][0]
            else:
                logger.info(f"No existing submission found for room {room_name}")
                return None
        except Exception as e:
            logger.error(f"Failed to get existing submission: {e}")
            return None
    
    async def get_existing_answers(self, submission_id: str) -> List[int]:
        """Get existing question IDs that have been answered for a submission via API"""
        try:
            endpoint = f"/submissions/{submission_id}/answers"
            
            response = await self._make_request("GET", endpoint)
            
            if response.get("answers"):
                question_ids = [answer.get("question_id") for answer in response["answers"] if answer.get("question_id")]
                logger.info(f"Found {len(question_ids)} existing answers for submission {submission_id}")
                return question_ids
            else:
                logger.info(f"No existing answers found for submission {submission_id}")
                return []
        except aiohttp.ClientResponseError as e:
            if e.status == 404:
                logger.warning(f"Submission {submission_id} not found in database - this is expected for new submissions")
                return []
            else:
                logger.error(f"Failed to get existing answers: {e}")
                return []
        except Exception as e:
            logger.error(f"Failed to get existing answers: {e}")
            return []
    
    async def get_lesson_details(self, lesson_uri: str, link_token: str) -> Dict[str, Any]:
        """Get lesson details and questions via API"""
        try:
            endpoint = f"/lessons/{lesson_uri}/details"
            params = {"token": link_token}
            
            logger.debug(f"Making API request to: {self.base_url}{endpoint}")
            logger.debug(f"With params: {params}")
            
            response = await self._make_request("GET", endpoint, params=params)
            logger.debug(f"Raw API response: {response}")
            logger.info(f"Retrieved lesson details for {lesson_uri}")
            
            # Convert the Edge Function response format to match what the main.py expects
            result = {
                "lesson": {
                    "id": response.get("id"),
                    "name": response.get("name"),
                    "description": response.get("description"),
                    "lesson_uri": response.get("lesson_uri"),
                    "intro_prompt": response.get("intro_prompt", "You are a friendly and encouraging AI voice teacher."),
                    "purpose_explanation": response.get("purpose_explanation", "Welcome! I'm here to help you learn."),
                    "greeting": response.get("greeting", "Hello, welcome to your lesson!"),
                    "closing": response.get("closing", "Thank you for completing the lesson. Great job!"),
                    "lesson_type": "lesson"  # Always set for lessons
                },
                "questions": response.get("questions", [])
            }
            
            logger.debug(f"Processed lesson data: {result}")
            logger.debug(f"Number of questions in response: {len(result.get('questions', []))}")
            
            return result
        except Exception as e:
            logger.error(f"Failed to get lesson details: {e}")
            raise
    
    async def get_lesson_details_by_id(self, lesson_id: int) -> Dict[str, Any]:
        """Get lesson details and questions via API using lesson ID"""
        try:
            endpoint = f"/lessons/{lesson_id}/details-by-id"
            
            logger.debug(f"Making API request to: {self.base_url}{endpoint}")
            
            response = await self._make_request("GET", endpoint)
            logger.debug(f"Raw API response: {response}")
            logger.info(f"Retrieved lesson details for ID {lesson_id}")
            
            # Convert the Edge Function response format to match what the main.py expects
            result = {
                "lesson": {
                    "id": response.get("id"),
                    "name": response.get("name"),
                    "description": response.get("description"),
                    "lesson_uri": response.get("lesson_uri"),
                    "intro_prompt": response.get("intro_prompt", "You are a friendly and encouraging AI voice teacher."),
                    "purpose_explanation": response.get("purpose_explanation", "Welcome! I'm here to help you learn."),
                    "greeting": response.get("greeting", "Hello, welcome to your lesson!"),
                    "closing": response.get("closing", "Thank you for completing the lesson. Great job!"),
                    "lesson_type": "lesson"  # Always set for lessons
                },
                "questions": response.get("questions", [])
            }
            
            logger.debug(f"Processed lesson data: {result}")
            logger.debug(f"Number of questions in response: {len(result.get('questions', []))}")
            
            return result
        except Exception as e:
            logger.error(f"Failed to get lesson details by ID: {e}")
            raise
    
    async def create_lesson_submission(self, lesson_id: int, link_token: str, link_type: str, 
                                      room_name: str = None, s3_recording_url: str = None, 
                                      call_timestamp: str = None) -> Dict[str, Any]:
        """Create a new lesson submission via API"""
        try:
            endpoint = "/lesson-submissions"
            data = {
                "lesson_id": lesson_id,
                "link_token": link_token,
                "link_type": link_type
            }
            
            # Add optional fields
            if room_name:
                data["room_name"] = room_name
            if s3_recording_url:
                data["s3_recording_url"] = s3_recording_url
            if call_timestamp:
                data["call_timestamp"] = call_timestamp
            
            response = await self._make_request("POST", endpoint, data=data)
            logger.info(f"Created lesson submission with ID: {response.get('submission_id')}")
            return response
        except Exception as e:
            logger.error(f"Failed to create lesson submission: {e}")
            raise
    
    async def submit_lesson_answers(self, submission_id: str, answers: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Submit answers for a lesson submission via API"""
        try:
            endpoint = f"/lesson-submissions/{submission_id}/answers"
            data = {"answers": answers}
            
            response = await self._make_request("POST", endpoint, data=data)
            logger.info(f"Submitted {len(answers)} answers for lesson submission {submission_id}")
            return response
        except ClientResponseError as e:
            if e.status == 404:
                logger.warning(f"Lesson submission {submission_id} not found in database - cannot submit answers")
                raise
            else:
                logger.error(f"Failed to submit lesson answers: {e}")
                raise
        except Exception as e:
            logger.error(f"Failed to submit lesson answers: {e}")
            raise
    
    async def get_existing_lesson_submission(self, room_name: str) -> Optional[Dict[str, Any]]:
        """Get existing lesson submission by room name via API"""
        try:
            endpoint = "/lesson-submissions"
            params = {"room_name": room_name}
            
            response = await self._make_request("GET", endpoint, params=params)
            
            if response.get("submissions") and len(response["submissions"]) > 0:
                logger.info(f"Found existing lesson submission for room {room_name}")
                return response["submissions"][0]
            else:
                logger.info(f"No existing lesson submission found for room {room_name}")
                return None
        except Exception as e:
            logger.error(f"Failed to get existing lesson submission: {e}")
            return None

# Global API client instance
api_client = SurveyAPIClient()

# Legacy wrapper functions for backward compatibility
async def get_campaign_by_uri_and_token(campaign_uri: str, link_token: str) -> Dict[str, Any]:
    """Get campaign details by URI and token"""
    return await api_client.get_campaign_details(campaign_uri, link_token)

async def get_campaign_by_id(campaign_id: int) -> Dict[str, Any]:
    """Get campaign details by ID"""
    return await api_client.get_campaign_details_by_id(campaign_id)

async def record_survey_submission_api(campaign_id: int, link_token: str, link_type: str,
                                     room_name: str = None, s3_recording_url: str = None,
                                     call_timestamp: str = None) -> str:
    """Record a survey submission via API"""
    response = await api_client.create_submission(
        campaign_id=campaign_id,
        link_token=link_token,
        link_type=link_type,
        room_name=room_name,
        s3_recording_url=s3_recording_url,
        call_timestamp=call_timestamp
    )
    return response.get("submission_id")

async def record_answer_api(submission_id: str, question_id: int, answer_text: str) -> bool:
    """Record a single answer via API"""
    answer_data = {
        "question_id": question_id,
        "answer_text": answer_text
    }
    
    try:
        await api_client.submit_answers(submission_id, [answer_data])
        return True
    except Exception as e:
        logger.error(f"Failed to record answer: {e}")
        return False

async def update_submission_s3_url_api(submission_id: str, s3_recording_url: str, is_lesson: bool = False) -> bool:
    """Update submission S3 URL via API"""
    try:
        if is_lesson:
            await api_client.update_lesson_submission_s3_url(submission_id, s3_recording_url)
        else:
            await api_client.update_submission_s3_url(submission_id, s3_recording_url)
        return True
    except Exception as e:
        logger.error(f"Failed to update submission S3 URL: {e}")
        return False

async def get_existing_submission_api(room_name: str) -> Optional[Dict[str, Any]]:
    """Get existing submission by room name via API"""
    return await api_client.get_existing_submission(room_name)

async def get_existing_answers_api(submission_id: str) -> List[int]:
    """Get existing answer question IDs via API"""
    return await api_client.get_existing_answers(submission_id)

async def get_lesson_by_uri_and_token(lesson_uri: str, link_token: str) -> Dict[str, Any]:
    """Get lesson details by URI and token"""
    return await api_client.get_lesson_details(lesson_uri, link_token)

async def get_lesson_by_id(lesson_id: int) -> Dict[str, Any]:
    """Get lesson details by ID"""
    return await api_client.get_lesson_details_by_id(lesson_id)

async def record_lesson_submission_api(lesson_id: int, link_token: str, link_type: str,
                                     room_name: str = None, s3_recording_url: str = None,
                                     call_timestamp: str = None) -> str:
    """Record a lesson submission via API"""
    response = await api_client.create_lesson_submission(
        lesson_id=lesson_id,
        link_token=link_token,
        link_type=link_type,
        room_name=room_name,
        s3_recording_url=s3_recording_url,
        call_timestamp=call_timestamp
    )
    return response.get("submission_id")

async def get_existing_lesson_submission_api(room_name: str) -> Optional[Dict[str, Any]]:
    """Get existing lesson submission by room name via API"""
    return await api_client.get_existing_lesson_submission(room_name)

async def submit_quiz_answer_api(submission_id: str, question_id: int, answer_text: str, 
                                is_correct: bool, points_earned: int, feedback: str = None,
                                is_lesson: bool = False) -> bool:
    """Submit a quiz answer with correctness and points via API"""
    answer_data = {
        "question_id": question_id,
        "answer_text": answer_text,
        "is_correct": is_correct,
        "points_earned": points_earned
    }
    if feedback:
        answer_data["feedback"] = feedback
    
    try:
        if is_lesson:
            await api_client.submit_lesson_answers(submission_id, [answer_data])
        else:
            await api_client.submit_answers(submission_id, [answer_data])
        return True
    except Exception as e:
        logger.error(f"Failed to submit quiz answer: {e}")
        return False

async def create_lesson_performance_api(submission_id: str, lesson_id: int, 
                                       total_questions: int, correct_answers: int,
                                       total_points: int, points_earned: int,
                                       score_percentage: float, 
                                       completion_time_seconds: int = None) -> bool:
    """Create or update lesson performance record via API"""
    try:
        endpoint = "/lesson-performance"
        data = {
            "submission_id": submission_id,
            "lesson_id": lesson_id,
            "total_questions": total_questions,
            "correct_answers": correct_answers,
            "total_points": total_points,
            "points_earned": points_earned,
            "score_percentage": score_percentage
        }
        if completion_time_seconds:
            data["completion_time_seconds"] = completion_time_seconds
        
        await api_client._make_request("POST", endpoint, data=data)
        logger.info(f"Created lesson performance record for submission {submission_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to create lesson performance: {e}")
        return False

# Cleanup function
async def cleanup_api_client():
    """Cleanup API client resources"""
    await api_client.close()
