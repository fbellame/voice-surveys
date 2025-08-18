import yaml
from dataclasses import dataclass, field
from typing import Optional, Any

from livekit.agents import (Agent, AgentSession)
# Import shared types for consistency
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'packages/shared'))
from python_types import SurveyProgress, TranscriptEntry

@dataclass
class UserData:
    customer_first_name: Optional[str] = None
    customer_last_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    questionnaire_answers: dict[str, str] = field(default_factory=dict)
    recording_id: Optional[str] = None
    s3_recording_url: Optional[str] = None
    
    # Survey data
    questions: list = field(default_factory=list)
    campaign: dict = field(default_factory=dict)
    submission_id: Optional[str] = None
    call_id: Optional[str] = None
    
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
        }
        return yaml.dump(data)