import { useState, useEffect, useCallback } from 'react';
import { Room, RoomEvent, Track, RemoteParticipant, LocalParticipant, Participant } from 'livekit-client';
import { LIVEKIT_CONFIG } from '@/config/livekit';

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
  status: 'started' | 'in_progress' | 'completed' | 'error';
  statusMessage: string;
}

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
    statusMessage: ''
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
          setSurveyProgress(prev => ({
            ...prev,
            currentQuestionNumber: data.current_question_number,
            currentQuestionText: data.current_question_text,
            totalQuestions: data.total_questions,
            answeredQuestions: data.answered_questions,
            lastAnswer: data.last_answer,
            completionPercentage: data.completion_percentage || 0
          }));
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
            statusMessage: data.message || ''
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
      statusMessage: ''
    });
    setTranscript([]);
    setIsReceivingData(false);
  }, []);

  const joinRoom = useCallback(async (roomName: string, userName: string, token?: string) => {
    if (isConnecting || isConnected) return;

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
      newRoom.on(RoomEvent.ActiveSpeakersChanged, () => {
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
        if (track.kind === Track.Kind.Audio) {
          const audioElement = track.attach();
          audioElement.play().catch(console.error);
        }
        updateParticipants(newRoom);
      });

      newRoom.on(RoomEvent.TrackUnsubscribed, () => {
        updateParticipants(newRoom);
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
      
      // Enable audio by default
      await newRoom.localParticipant.setMicrophoneEnabled(true);
      
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

  // Helper functions for easier access to survey data
  const getCurrentQuestion = useCallback(() => {
    const currentQuestionNum = parseInt(surveyProgress.currentQuestionNumber || '0');
    return {
      number: surveyProgress.currentQuestionNumber,
      text: surveyProgress.currentQuestionText,
      isAnswered: currentQuestionNum > 0 && currentQuestionNum <= surveyProgress.answeredQuestions
    };
  }, [surveyProgress]);

  const getProgressStats = useCallback(() => {
    return {
      completed: surveyProgress.answeredQuestions,
      total: surveyProgress.totalQuestions,
      percentage: surveyProgress.completionPercentage,
      isComplete: surveyProgress.status === 'completed'
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