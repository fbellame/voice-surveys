import { AccessToken } from 'livekit-server-sdk';
import { LIVEKIT_CONFIG } from '@/config/livekit';

export async function generateToken(roomName: string, participantName: string): Promise<string> {
  console.log('=== LiveKit Token Generation Debug ===');
  console.log('LIVEKIT_API_KEY:', LIVEKIT_CONFIG.LIVEKIT_API_KEY);
  console.log('LIVEKIT_API_SECRET:', LIVEKIT_CONFIG.LIVEKIT_API_SECRET ? '***SET***' : '***NOT SET***');
  console.log('LIVEKIT_URL:', LIVEKIT_CONFIG.LIVEKIT_URL);
  console.log('Room name:', roomName);
  console.log('Participant name:', participantName);
  console.log('=====================================');

  const at = new AccessToken(
    LIVEKIT_CONFIG.LIVEKIT_API_KEY,
    LIVEKIT_CONFIG.LIVEKIT_API_SECRET,
    {
      identity: participantName,
    }
  );

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  return await at.toJwt();
}