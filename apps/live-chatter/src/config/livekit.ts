// Debug environment variables
console.log('=== LiveKit Config Debug ===');
console.log('VITE_LIVEKIT_API_KEY:', import.meta.env.VITE_LIVEKIT_API_KEY);
console.log('VITE_LIVEKIT_API_SECRET:', import.meta.env.VITE_LIVEKIT_API_SECRET ? '***SET***' : '***NOT SET***');
console.log('VITE_LIVEKIT_URL:', import.meta.env.VITE_LIVEKIT_URL);
console.log('================================');

export const LIVEKIT_CONFIG = {
  LIVEKIT_API_KEY: import.meta.env.VITE_LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET: import.meta.env.VITE_LIVEKIT_API_SECRET,
  LIVEKIT_URL: import.meta.env.VITE_LIVEKIT_URL || "wss://alex-6mb80ejp.livekit.cloud"
} as const;

export const DEFAULT_ROOM_NAME = "audio-room";