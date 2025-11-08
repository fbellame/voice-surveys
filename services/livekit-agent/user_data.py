import yaml
from dataclasses import dataclass, field
from typing import Optional, Any

from livekit.agents import (Agent, AgentSession)

@dataclass
class UserData:
    customer_first_name: Optional[str] = None
    customer_last_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    questionnaire_answers: dict[str, str] = field(default_factory=dict)
    recording_id: Optional[str] = None
    s3_recording_url: Optional[str] = None
    
    # Lesson data
    questions: list = field(default_factory=list)
    lesson: dict = field(default_factory=dict)
    campaign: dict = field(default_factory=dict)  # Kept for backward compatibility, maps to lesson
    submission_id: Optional[str] = None
    call_id: Optional[str] = None
    
    # Submission tracking - NEW FIELDS FOR HARDENING
    submitted_answers: set[str] = field(default_factory=set)  # Track which answers have been submitted
    survey_completed: bool = False  # Track if survey was marked as completed
    finalization_attempted: bool = False  # Track if finalization was attempted
    
    # Quiz/Lesson tracking - NEW FIELDS FOR LESSON MODE
    is_lesson_mode: bool = False  # Whether this is a lesson (quiz) or survey
    quiz_answers: dict[str, dict] = field(default_factory=dict)  # Track quiz answers with correctness: {q_num: {"answer": str, "is_correct": bool, "points": int}}
    total_points_earned: int = 0  # Total points earned in quiz
    total_points_possible: int = 0  # Total points possible
    correct_count: int = 0  # Number of correct answers
    performance_feedback: list[str] = field(default_factory=list)  # Encouragement messages given
    
    # LiveKit components
    agents: dict[str, Agent] = field(default_factory=dict)
    prev_agent: Optional[Agent] = None
    session: Optional[AgentSession] = None
    room: Optional[Any] = None  # LiveKit room object
    

    def summarize(self) -> str:
        data = {
            "customer_first_name": self.customer_first_name or "unknown",
            "customer_last_name": self.customer_last_name or "unknown",
            "customer_phone": self.customer_phone or "unknown",
            "customer_email": self.customer_email or "unknown",
            "questionnaire_answers": self.questionnaire_answers or "unknown",
            "recording_id": self.recording_id or "unknown",
            "s3_recording_url": self.s3_recording_url or "unknown",
            "submission_id": self.submission_id or "unknown",
            "campaign_id": self.campaign.get("id") if self.campaign else "unknown",
            "submitted_answers": list(self.submitted_answers) if self.submitted_answers else "none",
            "survey_completed": self.survey_completed,
            "finalization_attempted": self.finalization_attempted,
        }
        return yaml.dump(data)