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

export interface QuizRecapQuestion {
  question_number: string;
  question_text: string;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
  points_earned: number;
  rationale?: string;
}

export interface QuizRecap {
  total_questions: number;
  correct_answers: number;
  incorrect_answers: number;
  score_percentage: number;
  points_earned: number;
  total_points: number;
  questions: QuizRecapQuestion[];
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
  // Lesson/Quiz specific fields
  isLessonMode?: boolean;
  isQuizQuestion?: boolean;
  lastAnswerCorrect?: boolean;
  pointsEarned?: number;
  totalPoints?: number;
  correctAnswers?: number;
  encouragementMessage?: string;
  quizRecap?: QuizRecap;
}
