import { useState, useEffect, useCallback } from 'react';
import { Room, RoomEvent, Track, RemoteParticipant, LocalParticipant, Participant } from 'livekit-client';
import { LIVEKIT_CONFIG } from '@/config/livekit';
import type { ParticipantInfo, TranscriptEntry, SurveyProgress } from '@shared/livekit.types';

export function useLiveKit() {
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [localParticipant, setLocalParticipant] = useState<LocalParticipant | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // New state for real-time survey tracking
  const [surveyProgress, setSurveyProgress] = useState<SurveyProgress>({
    currentQuestionNumber: null,
    currentQuestionText: null,
    totalQuestions: 0,
    answeredQuestions: 0,
    lastAnswer: null,
    completionPercentage: 0,
    status: 'started',
    statusMessage: '',
    isLessonMode: false,
    isQuizQuestion: false,
    lastAnswerCorrect: undefined,
    pointsEarned: 0,
    totalPoints: 0,
    correctAnswers: 0
  });
  
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isReceivingData, setIsReceivingData] = useState(false);

  const updateParticipants = useCallback((room: Room) => {
    const allParticipants = [room.localParticipant, ...Array.from(room.remoteParticipants.values())];
    
    const participantInfos: ParticipantInfo[] = allParticipants.map(participant => ({
      participant,
      isSpeaking: participant.isSpeaking,
      audioEnabled: participant.isMicrophoneEnabled ?? false,
    }));
    
    setParticipants(participantInfos);
  }, []);

  // Handle data messages from agent
  const handleDataReceived = useCallback((payload: Uint8Array, participant?: Participant) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(payload));
      setIsReceivingData(true);
      
      console.log('Received data message:', data);
      
      switch (data.type) {
        case 'survey_progress':
          console.log('📊 Survey progress update received:', {
            current_question_number: data.current_question_number,
            current_question_text: data.current_question_text,
            total_questions: data.total_questions,
            answered_questions: data.answered_questions,
            last_answer: data.last_answer
          });
          setSurveyProgress(prev => {
            const updated = {
              ...prev,
              currentQuestionNumber: data.current_question_number,
              currentQuestionText: data.current_question_text,
              totalQuestions: data.total_questions,
              answeredQuestions: data.answered_questions,
              lastAnswer: data.last_answer,
              completionPercentage: data.completion_percentage || 0,
              isLessonMode: data.is_lesson_mode || prev.isLessonMode || false,
              isQuizQuestion: data.is_quiz_question || false,
              lastAnswerCorrect: data.last_answer_correct,
              pointsEarned: data.points_earned ?? prev.pointsEarned ?? 0,
              totalPoints: data.total_points ?? prev.totalPoints ?? 0,
              correctAnswers: data.correct_answers ?? prev.correctAnswers ?? 0
            };
            console.log('📊 Survey progress state updated:', {
              currentQuestionNumber: updated.currentQuestionNumber,
              currentQuestionText: updated.currentQuestionText,
              answeredQuestions: updated.answeredQuestions,
              totalQuestions: updated.totalQuestions
            });
            return updated;
          });
          break;
          
        case 'transcript_update':
          const newEntry: TranscriptEntry = {
            speaker: data.speaker,
            text: data.text,
            timestamp: data.timestamp
          };
          
          setTranscript(prev => [...prev, newEntry]);
          break;
          
        case 'survey_status':
          setSurveyProgress(prev => ({
            ...prev,
            status: data.status,
            statusMessage: data.message || '',
            encouragementMessage: data.encouragement_message || prev.encouragementMessage
          }));
          break;
          
        case 'quiz_feedback':
          // Lesson-specific feedback for quiz answers
          console.log('📝 Quiz feedback received:', {
            question_number: data.question_number,
            is_correct: data.is_correct,
            user_answer: data.user_answer,
            correct_answer: data.correct_answer
          });
          setSurveyProgress(prev => ({
            ...prev,
            lastAnswerCorrect: data.is_correct,
            pointsEarned: data.points_earned ?? prev.pointsEarned ?? 0,
            correctAnswers: data.correct_answers ?? prev.correctAnswers ?? 0,
            encouragementMessage: data.feedback || data.message
          }));
          break;
          
        case 'quiz_recap':
          console.log('📊 Quiz recap received:', {
            total_questions: data.total_questions,
            correct_answers: data.correct_answers,
            score_percentage: data.score_percentage,
            questions: data.questions?.length
          });
          setSurveyProgress(prev => ({
            ...prev,
            quizRecap: data,
            status: 'completed'
          }));
          break;
          
        default:
          console.log('Unknown data message type:', data.type);
      }
    } catch (error) {
      console.error('Error parsing data message:', error);
    }
  }, []);

  // Clear survey data
  const clearSurveyData = useCallback(() => {
    setSurveyProgress({
      currentQuestionNumber: null,
      currentQuestionText: null,
      totalQuestions: 0,
      answeredQuestions: 0,
      lastAnswer: null,
      completionPercentage: 0,
      status: 'started',
      statusMessage: '',
      isLessonMode: false,
      isQuizQuestion: false,
      lastAnswerCorrect: undefined,
      pointsEarned: 0,
      totalPoints: 0,
      correctAnswers: 0
    });
    setTranscript([]);
    setIsReceivingData(false);
  }, []);

  const joinRoom = useCallback(async (roomName: string, userName: string, token?: string) => {
    // If already connecting or connected to a different room, disconnect first
    if (isConnecting) {
      console.log('Already connecting, waiting...');
      return;
    }
    
    if (isConnected && room) {
      console.log('Already connected, disconnecting from current room first...');
      await room.disconnect();
      setRoom(null);
      setIsConnected(false);
      setLocalParticipant(null);
      setParticipants([]);
      clearSurveyData();
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsConnecting(true);
    setError(null);
    clearSurveyData(); // Clear previous survey data

    try {
      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      // Set up event listeners
      newRoom.on(RoomEvent.Connected, () => {
        setIsConnected(true);
        setLocalParticipant(newRoom.localParticipant);
        updateParticipants(newRoom);
        console.log('Connected to room:', roomName);
      });

      newRoom.on(RoomEvent.Disconnected, () => {
        setIsConnected(false);
        setLocalParticipant(null);
        setParticipants([]);
        clearSurveyData();
        console.log('Disconnected from room');
      });

      newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        updateParticipants(newRoom);
        console.log('Participant connected:', participant.identity);
      });

      newRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
        updateParticipants(newRoom);
        console.log('Participant disconnected:', participant.identity);
      });

      newRoom.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        updateParticipants(newRoom);
      });

      // Speaking detection
      newRoom.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        console.log('Active speakers changed:', speakers.map(s => ({
          identity: s.identity,
          audioLevel: s.audioLevel
        })));
        updateParticipants(newRoom);
      });

      newRoom.on(RoomEvent.TrackMuted, () => {
        updateParticipants(newRoom);
        if (newRoom.localParticipant) {
          setIsMuted(!newRoom.localParticipant.isMicrophoneEnabled);
        }
      });

      newRoom.on(RoomEvent.TrackUnmuted, () => {
        updateParticipants(newRoom);
        if (newRoom.localParticipant) {
          setIsMuted(!newRoom.localParticipant.isMicrophoneEnabled);
        }
      });

      // Handle track subscriptions for audio playback
      newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        console.log('Track subscribed:', {
          kind: track.kind,
          participant: participant.identity,
          trackName: track.name,
          source: track.source
        });
        if (track.kind === Track.Kind.Audio) {
          const audioElement = track.attach();
          audioElement.play().catch(console.error);
          console.log('Audio track attached and playing for participant:', participant.identity);
        }
        updateParticipants(newRoom);
      });

      newRoom.on(RoomEvent.TrackUnsubscribed, () => {
        updateParticipants(newRoom);
      });

      // Handle track published events (when local participant publishes)
      newRoom.on(RoomEvent.LocalTrackPublished, (publication, participant) => {
        console.log('Local track published:', {
          kind: publication.kind,
          trackName: publication.trackName,
          source: publication.source,
          participant: participant.identity
        });
        if (publication.kind === Track.Kind.Audio) {
          console.log('Local audio track published successfully - agent should be able to receive audio');
        }
      });

      // Handle track unpublished events
      newRoom.on(RoomEvent.LocalTrackUnpublished, (publication, participant) => {
        console.log('Local track unpublished:', {
          kind: publication.kind,
          trackName: publication.trackName,
          participant: participant.identity
        });
      });

      // *** NEW: Handle data messages from agent ***
      newRoom.on(RoomEvent.DataReceived, handleDataReceived);

      // Handle connection quality updates
      newRoom.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
        console.log('Connection quality changed:', quality, participant?.identity);
      });

      // Handle reconnection events
      newRoom.on(RoomEvent.Reconnecting, () => {
        console.log('Reconnecting to room...');
        setError('Reconnecting...');
      });

      newRoom.on(RoomEvent.Reconnected, () => {
        console.log('Reconnected to room');
        setError(null);
      });

      // Connect to room
      await newRoom.connect(LIVEKIT_CONFIG.LIVEKIT_URL, token);
      console.log('Connected to LiveKit room:', roomName);
      
      // Enable audio by default
      try {
        await newRoom.localParticipant.setMicrophoneEnabled(true);
        console.log('Microphone enabled successfully');
        
        // Check if audio track is published (with safety check)
        if (newRoom.localParticipant && newRoom.localParticipant.audioTracks) {
          const audioTracks = Array.from(newRoom.localParticipant.audioTracks.values());
          console.log('Audio tracks published:', audioTracks.length);
          if (audioTracks.length > 0) {
            console.log('Audio track details:', {
              kind: audioTracks[0].kind,
              source: audioTracks[0].source,
              isMuted: audioTracks[0].isMuted,
              trackName: audioTracks[0].trackName
            });
          } else {
            console.warn('WARNING: No audio tracks published after enabling microphone');
          }
        } else {
          console.warn('WARNING: audioTracks not available yet, may be initialized later');
        }
      } catch (micError) {
        console.error('Error enabling microphone:', micError);
        throw micError;
      }
      
      setRoom(newRoom);
    } catch (err) {
      console.error('Error joining room:', err);
      setError(err instanceof Error ? err.message : 'Failed to join room');
      setIsConnecting(false);
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, isConnected, updateParticipants, handleDataReceived, clearSurveyData]);

  const leaveRoom = useCallback(async () => {
    if (room) {
      await room.disconnect();
      setRoom(null);
      setIsConnected(false);
      setLocalParticipant(null);
      setParticipants([]);
      clearSurveyData();
    }
  }, [room, clearSurveyData]);

  const toggleMute = useCallback(async () => {
    if (localParticipant) {
      if (isMuted) {
        await localParticipant.setMicrophoneEnabled(true);
      } else {
        await localParticipant.setMicrophoneEnabled(false);
      }
      setIsMuted(!localParticipant.isMicrophoneEnabled);
    }
  }, [localParticipant, isMuted]);

  // Helper function to strip context from question text
  const stripContext = useCallback((text: string) => {
    if (!text) return text;
    // Remove [CONTEXT:...] pattern from the beginning or anywhere in the text
    return text.replace(/\[CONTEXT:[^\]]*\]/g, '').trim();
  }, []);

  // Helper functions for easier access to survey data
  const getCurrentQuestion = useCallback(() => {
    const currentQuestionNum = parseInt(surveyProgress.currentQuestionNumber || '0');
    const rawText = surveyProgress.currentQuestionText;
    return {
      number: surveyProgress.currentQuestionNumber,
      text: rawText ? stripContext(rawText) : rawText,
      rawText: rawText, // Keep original text with context for reference
      isAnswered: currentQuestionNum > 0 && currentQuestionNum <= surveyProgress.answeredQuestions
    };
  }, [surveyProgress, stripContext]);

  const getProgressStats = useCallback(() => {
    return {
      completed: surveyProgress.answeredQuestions,
      total: surveyProgress.totalQuestions,
      percentage: surveyProgress.completionPercentage,
      isComplete: surveyProgress.status === 'completed' || surveyProgress.status === 'closing'
    };
  }, [surveyProgress]);

  const getRecentTranscript = useCallback((limit: number = 10) => {
    return transcript.slice(-limit);
  }, [transcript]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [room]);

  return {
    // Original LiveKit functionality
    room,
    isConnected,
    isConnecting,
    participants,
    localParticipant,
    isMuted,
    error,
    joinRoom,
    leaveRoom,
    toggleMute,
    
    // New survey tracking functionality
    surveyProgress,
    transcript,
    isReceivingData,
    
    // Helper functions
    getCurrentQuestion,
    getProgressStats,
    getRecentTranscript,
    clearSurveyData
  };
}