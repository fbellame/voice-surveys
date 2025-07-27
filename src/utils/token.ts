import { AccessToken } from 'livekit-server-sdk';
import { LIVEKIT_CONFIG } from '@/config/livekit';

export async function generateToken(roomName: string, participantName: string): Promise<string> {
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