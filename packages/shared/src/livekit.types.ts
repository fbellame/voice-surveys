import type { Participant } from 'livekit-client';

export interface ParticipantInfo {
  participant: Participant;
  isSpeaking: boolean;
  audioEnabled: boolean;
}

export interface TranscriptEntry {
  speaker: 'agent' | 'participant';
  text: string;
  timestamp: string;
}

export interface SurveyProgress {
  currentQuestionNumber: string | null;
  currentQuestionText: string | null;
  totalQuestions: number;
  answeredQuestions: number;
  lastAnswer: string | null;
  completionPercentage: number;
  status: 'started' | 'in_progress' | 'completed' | 'closing' | 'error';
  statusMessage: string;
}
