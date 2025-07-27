import { useState, useEffect, useCallback } from 'react';
import { Room, RoomEvent, Track, RemoteParticipant, LocalParticipant, Participant } from 'livekit-client';
import { LIVEKIT_CONFIG } from '@/config/livekit';

export interface ParticipantInfo {
  participant: Participant;
  isSpeaking: boolean;
  audioEnabled: boolean;
}

export function useLiveKit() {
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [localParticipant, setLocalParticipant] = useState<LocalParticipant | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateParticipants = useCallback((room: Room) => {
    const allParticipants = [room.localParticipant, ...Array.from(room.remoteParticipants.values())];
    
    const participantInfos: ParticipantInfo[] = allParticipants.map(participant => ({
      participant,
      isSpeaking: participant.isSpeaking,
      audioEnabled: participant.isMicrophoneEnabled ?? false,
    }));
    
    setParticipants(participantInfos);
  }, []);

  const joinRoom = useCallback(async (roomName: string, userName: string, token?: string) => {
    if (isConnecting || isConnected) return;

    setIsConnecting(true);
    setError(null);

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
      });

      newRoom.on(RoomEvent.Disconnected, () => {
        setIsConnected(false);
        setLocalParticipant(null);
        setParticipants([]);
      });

      newRoom.on(RoomEvent.ParticipantConnected, () => {
        updateParticipants(newRoom);
      });

      newRoom.on(RoomEvent.ParticipantDisconnected, () => {
        updateParticipants(newRoom);
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
  }, [isConnecting, isConnected, updateParticipants]);

  const leaveRoom = useCallback(async () => {
    if (room) {
      await room.disconnect();
      setRoom(null);
      setIsConnected(false);
      setLocalParticipant(null);
      setParticipants([]);
    }
  }, [room]);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [room]);

  return {
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
  };
}