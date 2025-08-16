"""
Python type definitions that mirror the shared TypeScript types.
This ensures consistency between the Python agent and TypeScript frontends.
"""

from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field
from datetime import datetime

# Survey types (mirroring packages/shared/src/survey.ts)
QuestionKind = Literal['single', 'multi', 'free', 'scale']

class Question(BaseModel):
    id: str
    kind: QuestionKind
    label: str
    options: Optional[List[str]] = None
    required: bool = True

class Campaign(BaseModel):
    id: str
    name: str
    startsAt: str
    endsAt: Optional[str] = None
    questions: List[Question]

# Survey submission types (mirroring packages/shared/src/survey-submission.types.ts)
class SurveySubmissionData(BaseModel):
    campaign_id: int
    link_token: str
    link_type: Literal['generic', 'personal']
    room_name: Optional[str] = None
    s3_recording_url: Optional[str] = None
    call_timestamp: Optional[str] = None

class UserProfileData(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    geography: Optional[str] = None
    occupation: Optional[str] = None
    phone_number: Optional[str] = None
    invitation_token: Optional[str] = None

class AnonymousSubmissionData(SurveySubmissionData):
    link_type: Literal['generic'] = 'generic'

class PersonalSubmissionData(SurveySubmissionData):
    link_type: Literal['personal'] = 'personal'
    user_profile_data: UserProfileData

# LiveKit types (mirroring packages/shared/src/livekit.types.ts)
class SurveyProgress(BaseModel):
    currentQuestionNumber: Optional[str] = None
    currentQuestionText: Optional[str] = None
    totalQuestions: int
    answeredQuestions: int
    lastAnswer: Optional[str] = None
    completionPercentage: int
    status: Literal['started', 'in_progress', 'completed', 'closing', 'error']
    statusMessage: str

class TranscriptEntry(BaseModel):
    speaker: Literal['agent', 'participant']
    text: str
    timestamp: str
