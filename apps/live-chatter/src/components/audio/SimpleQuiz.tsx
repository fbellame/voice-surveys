import { useState, useEffect, useCallback } from 'react';
import { useLiveKit } from '@/hooks/useLiveKit';
import { generateToken } from '@/utils/token';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mic, MicOff, User, Bot, Check, Link, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface Quiz {
  id: string;
  title: string;
  document_id: string;
  difficulty_mix: any;
  settings: any;
}

interface Question {
  id: string;
  quiz_id: string;
  type: 'mcq' | 'true_false' | 'short_answer' | 'cloze';
  prompt: string;
  options: any;
  correct_answer: any;
  rationale: string | null;
  bloom_level: string | null;
}

interface QuizLink {
  id: string;
  quiz_id: string;
  unique_token: string;
  name: string | null;
  is_active: boolean;
  max_attempts: number | null;
  expires_at: string | null;
  created_by: string;
}

interface SimpleQuizProps {
  quiz?: Quiz | null;
  quizLink?: QuizLink | null;
  questions?: Question[];
  onComplete?: () => void;
}

export function SimpleQuiz({ quiz, quizLink, questions = [], onComplete }: SimpleQuizProps) {
  const [quizActive, setQuizActive] = useState(false);
  const [showUserForm, setShowUserForm] = useState(true);
  const [currentRoomName, setCurrentRoomName] = useState<string>('');
  const [userInfo, setUserInfo] = useState({
    fullName: '',
  });
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [isAutoCompleting, setIsAutoCompleting] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const { toast } = useToast();

  const {
    isConnected,
    isConnecting,
    participants,
    isMuted,
    toggleMute,
    joinRoom,
    leaveRoom,
    // Quiz tracking
    surveyProgress,
    transcript,
    getCurrentQuestion,
    getProgressStats
  } = useLiveKit();

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
    });
  }, []);

  // Find agent and user participants
  const agent = participants.find(p => p.participant.identity.includes('agent') || p.participant.identity.includes('bot'));
  const localUser = participants.find(p => p.participant.isLocal);
  const isAgentSpeaking = agent?.isSpeaking || false;
  const isUserSpeaking = localUser?.isSpeaking || false;

  const handleUserInfoSubmit = async () => {
    // For anonymous quizzes, only require a nickname
    if (!userInfo.fullName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide a nickname to continue",
        variant: "destructive"
      });
      return;
    }
    
    if (!quiz || !quizLink) {
      toast({
        title: "Error",
        description: "Quiz data not available",
        variant: "destructive"
      });
      return;
    }

    try {
      // Generate room name using quiz link token
      // Format: quiz-{token} so the agent can extract the token
      // The agent extracts token by removing "quiz-" prefix
      const roomName = `quiz-${quizLink.unique_token}`;
      
      console.log('Creating quiz attempt with room name:', roomName);
      console.log('Quiz ID:', quiz.id);
      console.log('Link token:', quizLink.unique_token);

      // Check if there's an existing unfinished attempt for this link token
      const { data: existingAttempt, error: checkError } = await supabase
        .from('attempts')
        .select('id')
        .eq('link_token', quizLink.unique_token)
        .eq('is_anonymous', true)
        .is('user_id', null)
        .is('finished_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing attempt:', checkError);
      }

      let attempt;
      if (existingAttempt) {
        // Use existing unfinished attempt
        console.log('Using existing unfinished attempt:', existingAttempt.id);
        attempt = existingAttempt;
      } else {
        // Create new anonymous attempt in attempts table
        const { data: newAttempt, error: attemptError } = await supabase
          .from('attempts')
          .insert({
            quiz_id: quiz.id,
            user_id: null, // NULL for anonymous attempts
            link_token: quizLink.unique_token,
            is_anonymous: true,
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (attemptError) {
          console.error('Error creating attempt:', attemptError);
          toast({
            title: "Error",
            description: "Failed to create quiz attempt",
            variant: "destructive"
          });
          return;
        }

        console.log('Quiz attempt created successfully:', newAttempt);
        attempt = newAttempt;
      }
      
      // Store the room name and attempt ID for later use
      setCurrentRoomName(roomName);
      setShowUserForm(false);
      
      // Start the quiz session
      startQuiz(roomName);
    } catch (error) {
      console.error('Error creating quiz attempt:', error);
      toast({
        title: "Error",
        description: "Failed to start quiz",
        variant: "destructive"
      });
    }
  };

  const startQuiz = async (roomName: string = '') => {
    try {
      // If already connected, leave first
      if (isConnected) {
        console.log('Already connected, leaving room first...');
        await leaveRoom();
        // Wait a bit for cleanup
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const finalRoomName = roomName || currentRoomName;
      
      if (!finalRoomName) {
        console.error('No room name available');
        toast({
          title: "Error",
          description: "Failed to start quiz - no room name available",
          variant: "destructive"
        });
        return;
      }
      
      const userName = userInfo.fullName || `user-${Math.floor(Math.random() * 10000)}`;
      
      console.log('Starting quiz with room name:', finalRoomName);
      console.log('User name:', userName);
      console.log('Quiz ID:', quiz?.id);
      console.log('Link token:', quizLink?.unique_token);
      
      const token = await generateToken(finalRoomName, userName);
      console.log('Token generated, joining room...');
      
      await joinRoom(finalRoomName, userName, token);
      setCurrentRoomName(finalRoomName);
      setQuizActive(true);
      
      console.log('Room joined successfully, quiz active:', quizActive);
      
      toast({
        title: "Quiz Started",
        description: "Your quiz session has begun. The AI teacher will join shortly.",
      });
    } catch (err) {
      console.error('Error starting quiz:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: "Failed to Start Quiz",
        description: errorMessage || "Please try again",
        variant: "destructive"
      });
      setQuizActive(false);
    }
  };

  const endQuiz = useCallback(async () => {
    await leaveRoom();
    setQuizActive(false);
    setIsAutoCompleting(false);
    
    if (currentRoomName && quiz) {
      try {
        // Find the existing attempt for this room (by link token)
        const linkToken = quizLink?.unique_token;
        if (linkToken) {
          const { data: existingAttempt, error: checkError } = await supabase
            .from('attempts')
            .select('id')
            .eq('link_token', linkToken)
            .eq('is_anonymous', true)
            .is('user_id', null)
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (checkError) {
            console.error('Error checking existing attempt:', checkError);
          }

          if (existingAttempt) {
            // Update the attempt with completion timestamp
            const { error: updateError } = await supabase
              .from('attempts')
              .update({
                finished_at: new Date().toISOString(),
              })
              .eq('id', existingAttempt.id);

            if (updateError) {
              console.error('Error updating attempt:', updateError);
            } else {
              console.log('Quiz attempt updated with completion timestamp');
            }
          }
        }
      } catch (error) {
        console.error('Error updating quiz data:', error);
      }
    }
    
    toast({
      title: "Quiz Complete",
      description: "Thank you for completing the quiz",
    });
    
    if (onComplete) {
      onComplete();
    }
  }, [leaveRoom, quiz, currentRoomName, quizLink, onComplete, toast]);

  // Auto-complete quiz when AI agent sends closing status
  // Wait for recap to be received and give user time to review before showing completion screen
  useEffect(() => {
    if (surveyProgress.status === 'closing' && quizActive && isConnected && !isAutoCompleting) {
      console.log('Quiz closing status received from AI agent...');
      setIsAutoCompleting(true);
      
      // If recap is already received, give user time to review (15 seconds)
      if (surveyProgress.quizRecap) {
        console.log('Recap already received, giving user 15 seconds to review...');
        setCountdownSeconds(15);
        const timer = setTimeout(() => {
          setCountdownSeconds(null);
          endQuiz();
        }, 15000);
        
        // Update countdown every second
        const countdownInterval = setInterval(() => {
          setCountdownSeconds(prev => {
            if (prev === null || prev <= 1) {
              clearInterval(countdownInterval);
              return null;
            }
            return prev - 1;
          });
        }, 1000);
        
        return () => {
          clearTimeout(timer);
          clearInterval(countdownInterval);
        };
      } else {
        // Wait for recap to arrive (up to 10 seconds), then give 15 seconds for review
        console.log('Waiting for quiz recap...');
        let recapTimer: NodeJS.Timeout | null = null;
        let reviewTimer: NodeJS.Timeout | null = null;
        let countdownInterval: NodeJS.Timeout | null = null;
        
        const startReviewPeriod = () => {
          console.log('Recap received! Starting 15 second review period...');
          if (recapTimer) clearTimeout(recapTimer);
          setCountdownSeconds(15);
          reviewTimer = setTimeout(() => {
            setCountdownSeconds(null);
            endQuiz();
          }, 15000);
          
          // Update countdown every second
          countdownInterval = setInterval(() => {
            setCountdownSeconds(prev => {
              if (prev === null || prev <= 1) {
                if (countdownInterval) clearInterval(countdownInterval);
                return null;
              }
              return prev - 1;
            });
          }, 1000);
        };
        
        const checkRecap = () => {
          if (surveyProgress.quizRecap && !reviewTimer) {
            startReviewPeriod();
          }
        };
        
        // Check immediately in case recap arrives quickly
        checkRecap();
        
        // Set up interval to check for recap
        const interval = setInterval(() => {
          checkRecap();
        }, 500);
        
        // Fallback: if no recap after 10 seconds, show completion anyway
        recapTimer = setTimeout(() => {
          clearInterval(interval);
          if (!reviewTimer) {
            console.log('Recap timeout - showing completion screen');
            endQuiz();
          }
        }, 10000);
        
        return () => {
          clearInterval(interval);
          if (recapTimer) clearTimeout(recapTimer);
          if (reviewTimer) clearTimeout(reviewTimer);
          if (countdownInterval) clearInterval(countdownInterval);
        };
      }
    }
  }, [surveyProgress.status, surveyProgress.quizRecap, quizActive, isConnected, endQuiz, isAutoCompleting]);

  // Debug: Log connection and participant changes
  useEffect(() => {
    console.log('=== Quiz State Debug ===');
    console.log('isConnected:', isConnected);
    console.log('isConnecting:', isConnecting);
    console.log('quizActive:', quizActive);
    console.log('participants:', participants.length);
    console.log('participant identities:', participants.map(p => p.participant.identity));
    console.log('agent:', agent?.participant.identity);
    console.log('isAgentSpeaking:', isAgentSpeaking);
    console.log('isUserSpeaking:', isUserSpeaking);
    console.log('isMuted:', isMuted);
    console.log('currentQuestionNumber:', surveyProgress.currentQuestionNumber);
    console.log('currentQuestionText:', surveyProgress.currentQuestionText);
    console.log('answeredQuestions:', surveyProgress.answeredQuestions);
    console.log('totalQuestions:', surveyProgress.totalQuestions);
    console.log('surveyProgress object:', surveyProgress);
    console.log('========================');
  }, [isConnected, isConnecting, quizActive, participants, agent, isAgentSpeaking, isUserSpeaking, isMuted, surveyProgress]);

  // Monitor for agent joining
  useEffect(() => {
    if (quizActive && isConnected && !agent) {
      // Agent hasn't joined yet - check after a delay
      const timer = setTimeout(() => {
        if (quizActive && isConnected && !agent) {
          console.warn('Agent has not joined after 5 seconds. Room name:', currentRoomName);
          toast({
            title: "Waiting for AI Teacher",
            description: "The AI teacher is taking longer than expected to join. Please check if the agent service is running.",
            variant: "default"
          });
        }
      }, 5000);
      
      return () => clearTimeout(timer);
    } else if (agent && quizActive) {
      console.log('Agent detected:', agent.participant.identity);
    }
  }, [quizActive, isConnected, agent, currentRoomName]);

  if (!quizActive && !isConnected) {
    if (showUserForm && quizLink) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-8 space-y-6">
            <div className="mx-auto h-16 w-16 bg-gradient-primary rounded-full flex items-center justify-center mb-6">
              <Link className="h-8 w-8 text-white" />
            </div>
            
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-bold">
                {quiz?.title || "Quiz"}
              </h1>
              <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                Anonymous Quiz
              </div>
              <p className="text-muted-foreground">
                This is an anonymous quiz. Only a nickname is required.
              </p>
              {quizLink && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Shared quiz link
                  </p>
                  {quizLink.name && (
                    <p className="text-xs text-muted-foreground">
                      {quizLink.name}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nickname *</Label>
                <Input
                  id="fullName"
                  value={userInfo.fullName}
                  onChange={(e) => setUserInfo({...userInfo, fullName: e.target.value})}
                  placeholder="Enter a nickname (e.g., John, QuizUser123)"
                  className="bg-background"
                />
                <p className="text-xs text-muted-foreground">
                  This quiz is anonymous. Only a nickname is required.
                </p>
              </div>
            </div>

            <Button 
              onClick={handleUserInfoSubmit}
              disabled={isConnecting}
              className="w-full"
              variant="audio"
              size="lg"
            >
              {isConnecting ? "Starting..." : "Start Quiz"}
            </Button>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center space-y-6">
          <div className="mx-auto h-16 w-16 bg-gradient-primary rounded-full flex items-center justify-center mb-6">
            <Link className="h-8 w-8 text-white" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Ready to Start</h1>
            <p className="text-muted-foreground">
              Click the button below to begin your quiz
            </p>
          </div>

          <Button 
            onClick={() => setShowUserForm(true)}
            className="w-full"
            variant="audio"
            size="lg"
          >
            Start Quiz
          </Button>
        </Card>
      </div>
    );
  }

  // Get current question data from questions array
  // Fallback to first question if no progress update received yet
  const currentQuestionData = questions.find((q, idx) => {
    const questionNum = parseInt(surveyProgress.currentQuestionNumber || '0');
    // If no question number set yet, show first question as fallback
    if (questionNum === 0 && questions.length > 0) {
      return idx === 0;
    }
    return idx + 1 === questionNum;
  });
  
  // Fallback: if no progress update received but we have questions, show first question
  const displayQuestionNumber = surveyProgress.currentQuestionNumber || (questions.length > 0 ? '1' : '0');
  const displayQuestionText = surveyProgress.currentQuestionText || (currentQuestionData?.prompt || '');
  const displayTotalQuestions = surveyProgress.totalQuestions || questions.length;

  // Determine listening state: user should speak when agent is not speaking and question is asked
  const isListening = !isAgentSpeaking && !isMuted && surveyProgress.currentQuestionText && !isUserSpeaking;
  const shouldShowOptions = currentQuestionData && (currentQuestionData.type === 'mcq' || currentQuestionData.type === 'true_false');

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl p-8 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">
            Quiz in Progress
          </h2>
          {/* Status indicator */}
          <div className="flex items-center justify-center gap-2">
            {isAgentSpeaking && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium">AI Teacher is speaking...</span>
              </div>
            )}
            {isUserSpeaking && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium">You are speaking...</span>
              </div>
            )}
            {isListening && !isAgentSpeaking && !isUserSpeaking && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                <div className="h-2 w-2 bg-purple-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium">Listening for your answer...</span>
              </div>
            )}
          </div>
        </div>

        {/* Current Question Display */}
        {(displayQuestionText || (questions.length > 0 && currentQuestionData)) && (
          <Card className="p-6 bg-primary/5 border-2 border-primary/20">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-primary">
                      Question {displayQuestionNumber} of {displayTotalQuestions}
                    </span>
                    {getCurrentQuestion().isAnswered && (
                      <div className="h-5 w-5 bg-green-500 rounded-full flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {getCurrentQuestion().text || displayQuestionText || currentQuestionData?.prompt || 'Waiting for question...'}
                  </h3>
                </div>
              </div>

              {/* Answer Options for MCQ and True/False */}
              {shouldShowOptions && currentQuestionData && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Answer Options:</p>
                  {currentQuestionData.type === 'true_false' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 rounded-lg border-2 border-border bg-background text-center font-medium">
                        True
                      </div>
                      <div className="p-3 rounded-lg border-2 border-border bg-background text-center font-medium">
                        False
                      </div>
                    </div>
                  ) : currentQuestionData.type === 'mcq' && currentQuestionData.options ? (
                    <div className="space-y-2">
                      {Array.isArray(currentQuestionData.options) ? (
                        currentQuestionData.options.map((option: string, idx: number) => (
                          <div 
                            key={idx}
                            className="p-3 rounded-lg border-2 border-border bg-background"
                          >
                            <span className="font-medium mr-2">{String.fromCharCode(65 + idx)}.</span>
                            {option}
                          </div>
                        ))
                      ) : typeof currentQuestionData.options === 'object' ? (
                        Object.entries(currentQuestionData.options).map(([key, value]: [string, any]) => (
                          <div 
                            key={key}
                            className="p-3 rounded-lg border-2 border-border bg-background"
                          >
                            <span className="font-medium mr-2">{key}.</span>
                            {String(value)}
                          </div>
                        ))
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}

              {/* Last Answer Feedback */}
              {surveyProgress.lastAnswer && (
                <div className={cn(
                  "mt-4 pt-4 border-t-2 rounded-lg p-3",
                  surveyProgress.lastAnswerCorrect === true
                    ? "bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700"
                    : surveyProgress.lastAnswerCorrect === false
                    ? "bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-700"
                    : "border-border"
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Your Answer:</span>
                    {surveyProgress.lastAnswerCorrect !== undefined && (
                      <div className={cn(
                        "h-5 w-5 rounded-full flex items-center justify-center",
                        surveyProgress.lastAnswerCorrect 
                          ? "bg-green-500" 
                          : "bg-red-500"
                      )}>
                        {surveyProgress.lastAnswerCorrect ? (
                          <Check className="h-3 w-3 text-white" />
                        ) : (
                          <X className="h-3 w-3 text-white" />
                        )}
                      </div>
                    )}
                  </div>
                  <p className={cn(
                    "text-sm font-medium",
                    surveyProgress.lastAnswerCorrect === true
                      ? "text-green-700 dark:text-green-300"
                      : surveyProgress.lastAnswerCorrect === false
                      ? "text-red-700 dark:text-red-300"
                      : "text-foreground"
                  )}>
                    {surveyProgress.lastAnswer}
                  </p>
                  {surveyProgress.encouragementMessage && (
                    <p className={cn(
                      "text-sm mt-2",
                      surveyProgress.lastAnswerCorrect === true
                        ? "text-green-600 dark:text-green-400"
                        : surveyProgress.lastAnswerCorrect === false
                        ? "text-red-600 dark:text-red-400"
                        : "text-muted-foreground italic"
                    )}>
                      {surveyProgress.encouragementMessage}
                    </p>
                  )}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Quiz Progress */}
        {surveyProgress.totalQuestions > 0 && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">
                Quiz Progress
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                {getProgressStats().completed} of {getProgressStats().total} questions answered ({getProgressStats().percentage}%)
              </p>
              
              {/* Progress Bar */}
              <div className="bg-secondary/30 rounded-full h-3 overflow-hidden mb-4">
                <div 
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${getProgressStats().percentage}%` }}
                />
              </div>
              
              {/* Quiz Performance */}
              {surveyProgress.totalPoints > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Points Earned:</span>
                    <span className="font-semibold">{surveyProgress.pointsEarned} / {surveyProgress.totalPoints}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Correct Answers:</span>
                    <span className="font-semibold">{surveyProgress.correctAnswers} / {getProgressStats().total}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Audio Controls with Visual Feedback */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Button
              variant={isMuted ? "destructive" : isUserSpeaking ? "default" : "outline"}
              size="lg"
              onClick={toggleMute}
              className={cn(
                "rounded-full w-20 h-20 transition-all",
                isUserSpeaking && "ring-4 ring-green-500 ring-opacity-50 animate-pulse",
                !isMuted && !isUserSpeaking && isListening && "ring-4 ring-purple-500 ring-opacity-50"
              )}
            >
              {isMuted ? (
                <MicOff className="h-8 w-8" />
              ) : (
                <Mic className="h-8 w-8" />
              )}
            </Button>
            {isUserSpeaking && (
              <div className="absolute -inset-2 rounded-full bg-green-500/20 animate-ping" />
            )}
          </div>
          <p className="text-sm text-muted-foreground text-center">
            {isMuted 
              ? "Microphone is muted" 
              : isUserSpeaking 
                ? "Speaking..." 
                : isListening 
                  ? "Ready to listen" 
                  : "Click to toggle microphone"}
          </p>
        </div>

        {/* Participants with Enhanced Visual Feedback */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Participants</h3>
          <div className="grid grid-cols-2 gap-4">
            {participants.map((p, idx) => {
              const isAgent = p.participant.identity.includes('agent') || p.participant.identity.includes('bot');
              const isLocal = p.participant.isLocal;
              
              return (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all",
                    isLocal
                      ? isUserSpeaking 
                        ? "bg-green-500/10 border-green-500 text-green-700 dark:text-green-300"
                        : "bg-primary/10 border-primary/30 text-primary"
                      : isAgentSpeaking && isAgent
                        ? "bg-blue-500/10 border-blue-500 text-blue-700 dark:text-blue-300"
                        : "bg-muted border-border"
                  )}
                >
                  <div className={cn(
                    "relative",
                    isAgent ? "text-blue-500" : "text-primary"
                  )}>
                    {isAgent ? (
                      <Bot className="h-6 w-6" />
                    ) : (
                      <User className="h-6 w-6" />
                    )}
                    {(isAgentSpeaking && isAgent) || (isUserSpeaking && isLocal) ? (
                      <div className="absolute -inset-1 rounded-full bg-current opacity-20 animate-ping" />
                    ) : null}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      {isAgent ? "AI Teacher" : (isLocal ? userInfo.fullName || "You" : p.participant.identity)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {(isAgentSpeaking && isAgent) ? "Speaking..." : (isUserSpeaking && isLocal) ? "Speaking..." : "Ready"}
                    </div>
                  </div>
                  {((isAgentSpeaking && isAgent) || (isUserSpeaking && isLocal)) && (
                    <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Transcript */}
        {transcript.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Transcript</h3>
            <div className="max-h-64 overflow-y-auto space-y-2 p-4 bg-muted rounded-lg">
              {transcript.map((entry, idx) => (
                <div key={idx} className="text-sm">
                  <span className="font-semibold">{entry.speaker}:</span> {entry.text}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quiz Recap */}
        {surveyProgress.quizRecap && (
          <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/30">
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold">Quiz Results</h3>
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-primary">
                      {surveyProgress.quizRecap.score_percentage}%
                    </div>
                    <div className="text-sm text-muted-foreground">Score</div>
                  </div>
                  <div className="h-16 w-px bg-border" />
                  <div className="text-center">
                    <div className="text-4xl font-bold text-green-600">
                      {surveyProgress.quizRecap.correct_answers}
                    </div>
                    <div className="text-sm text-muted-foreground">Correct</div>
                  </div>
                  <div className="h-16 w-px bg-border" />
                  <div className="text-center">
                    <div className="text-4xl font-bold text-red-600">
                      {surveyProgress.quizRecap.incorrect_answers}
                    </div>
                    <div className="text-sm text-muted-foreground">Incorrect</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-lg font-semibold">Question Review</h4>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {surveyProgress.quizRecap.questions.map((q) => (
                    <Card
                      key={q.question_number}
                      className={cn(
                        "p-4 border-2",
                        q.is_correct
                          ? "bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700"
                          : "bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-700"
                      )}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">
                              Question {q.question_number}
                            </span>
                            {q.is_correct ? (
                              <Check className="h-5 w-5 text-green-600" />
                            ) : (
                              <X className="h-5 w-5 text-red-600" />
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {q.points_earned} point{q.points_earned !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <p className="text-sm font-medium">{q.question_text}</p>
                        <div className="space-y-1 text-sm">
                          <div>
                            <span className="font-medium text-muted-foreground">Your answer: </span>
                            <span className={cn(
                              q.is_correct ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"
                            )}>
                              {q.user_answer}
                            </span>
                          </div>
                          {!q.is_correct && (
                            <div>
                              <span className="font-medium text-muted-foreground">Correct answer: </span>
                              <span className="text-green-700 dark:text-green-300">
                                {q.correct_answer}
                              </span>
                            </div>
                          )}
                          {q.rationale && (
                            <p className="text-xs text-muted-foreground italic mt-1">
                              {q.rationale}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* End Quiz Button */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={endQuiz}
            disabled={isConnecting}
          >
            {surveyProgress.quizRecap ? 'View Summary & Close' : 'End Quiz'}
          </Button>
        </div>
        
        {/* Show message when recap is displayed */}
        {surveyProgress.quizRecap && surveyProgress.status === 'closing' && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {countdownSeconds !== null ? (
                <>Review your results above. The quiz will close automatically in <span className="font-semibold text-primary">{countdownSeconds}</span> second{countdownSeconds !== 1 ? 's' : ''}, or click the button above to close now.</>
              ) : (
                <>Review your results above. Click the button above to close the quiz.</>
              )}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

