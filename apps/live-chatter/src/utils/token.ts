import { supabase } from '@/integrations/supabase/client';

export async function generateToken(roomName: string, participantName: string): Promise<string> {
  console.log('=== LiveKit Token Generation Debug ===');
  console.log('Room name:', roomName);
  console.log('Participant name:', participantName);
  console.log('=====================================');

  // Call Supabase Edge Function to generate token server-side
  const { data, error } = await supabase.functions.invoke('generate-livekit-token', {
    body: {
      roomName,
      participantName,
    },
  });

  if (error) {
    console.error('Error generating token:', error);
    throw new Error(`Failed to generate token: ${error.message}`);
  }

  if (!data || !data.token) {
    throw new Error('Invalid response from token generation service');
  }

  return data.token;
}