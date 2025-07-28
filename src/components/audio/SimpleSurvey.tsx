import { useState } from 'react';
import { useLiveKit } from '@/hooks/useLiveKit';
import { generateToken } from '@/utils/token';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mic, MicOff, User, Bot } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface Campaign {
  id: number;
  name: string;
  description: string | null;
}

interface SimpleSurveyProps {
  campaign?: Campaign | null;
  onComplete?: () => void;
}

export function SimpleSurvey({ campaign, onComplete }: SimpleSurveyProps) {
  const [surveyActive, setSurveyActive] = useState(false);
  const { toast } = useToast();
  
  const {
    isConnected,
    isConnecting,
    participants,
    isMuted,
    toggleMute,
    joinRoom,
    leaveRoom,
  } = useLiveKit();

  // Find agent and user participants
  const agent = participants.find(p => p.participant.identity.includes('agent') || p.participant.identity.includes('bot'));
  const user = participants.find(p => p.participant.isLocal);
  const isAgentSpeaking = agent?.isSpeaking || false;
  const isUserSpeaking = user?.isSpeaking || false;

  const startSurvey = async () => {
    try {
      // Fetch room pattern from campaign_room_mapping
      const { data: roomMapping, error: roomError } = await supabase
        .from('campaign_room_mapping')
        .select('room_pattern')
        .eq('campaign_id', campaign?.id)
        .eq('is_active', true)
        .maybeSingle();

      if (roomError) {
        console.error('Error fetching room mapping:', roomError);
      }

      // Generate room name using pattern or fallback
      const roomPattern = roomMapping?.room_pattern || 'survey-{timestamp}';
      const roomName = roomPattern.replace('{timestamp}', Date.now().toString());
      const userName = `user-${Math.floor(Math.random() * 10000)}`;
      
      const token = await generateToken(roomName, userName);
      await joinRoom(roomName, userName, token);
      setSurveyActive(true);
      
      toast({
        title: "Survey Started",
        description: "Your future survey session has begun",
      });
    } catch (err) {
      toast({
        title: "Failed to Start Survey",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  const endSurvey = async () => {
    await leaveRoom();
    setSurveyActive(false);
    
    toast({
      title: "Survey Completed",
      description: "Thank you for participating",
    });
    
    if (onComplete) {
      onComplete();
    }
  };

  if (!surveyActive && !isConnected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center space-y-6">
          <div className="mx-auto h-16 w-16 bg-gradient-primary rounded-full flex items-center justify-center mb-6">
            <Bot className="h-8 w-8 text-white" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">
              {campaign?.name || "Future Survey"}
            </h1>
            <p className="text-muted-foreground">
              {campaign?.description || "Participate in an AI-powered survey about the future"}
            </p>
          </div>

          <Button 
            onClick={startSurvey}
            disabled={isConnecting}
            className="w-full"
            variant="audio"
            size="lg"
          >
            {isConnecting ? "Starting..." : "Start Future Survey"}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-8 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">
            {campaign?.name || "Survey"} in Progress
          </h2>
          <p className="text-muted-foreground">
            Please wait while the voice assistant speaks...
          </p>
        </div>

        {/* Speaking Indicators */}
        <div className="grid grid-cols-2 gap-6">
          {/* Agent Indicator */}
          <div className={cn(
            "flex flex-col items-center p-6 rounded-xl transition-all duration-300",
            isAgentSpeaking 
              ? "bg-gradient-speaking/20 ring-2 ring-audio-speaking shadow-speaking scale-105" 
              : "bg-secondary/50"
          )}>
            <div className={cn(
              "h-16 w-16 rounded-full flex items-center justify-center mb-4 transition-all duration-300",
              isAgentSpeaking 
                ? "bg-gradient-speaking shadow-glow" 
                : "bg-primary"
            )}>
              <Bot className={cn(
                "h-8 w-8",
                isAgentSpeaking ? "text-white" : "text-primary-foreground"
              )} />
            </div>
            <h3 className={cn(
              "text-lg font-semibold mb-2",
              isAgentSpeaking && "text-audio-speaking"
            )}>
              AI Agent
            </h3>
            <p className={cn(
              "text-sm",
              isAgentSpeaking 
                ? "text-audio-speaking font-medium" 
                : "text-muted-foreground"
            )}>
              {isAgentSpeaking ? "Speaking..." : "Listening"}
            </p>
          </div>

          {/* User Indicator */}
          <div className={cn(
            "flex flex-col items-center p-6 rounded-xl transition-all duration-300",
            isUserSpeaking 
              ? "bg-gradient-speaking/20 ring-2 ring-audio-speaking shadow-speaking scale-105" 
              : "bg-secondary/50"
          )}>
            <div className={cn(
              "h-16 w-16 rounded-full flex items-center justify-center mb-4 transition-all duration-300",
              isUserSpeaking 
                ? "bg-gradient-speaking shadow-glow" 
                : "bg-primary"
            )}>
              <User className={cn(
                "h-8 w-8",
                isUserSpeaking ? "text-white" : "text-primary-foreground"
              )} />
            </div>
            <h3 className={cn(
              "text-lg font-semibold mb-2",
              isUserSpeaking && "text-audio-speaking"
            )}>
              You
            </h3>
            <p className={cn(
              "text-sm",
              isUserSpeaking 
                ? "text-audio-speaking font-medium" 
                : isMuted 
                  ? "text-audio-muted"
                  : "text-muted-foreground"
            )}>
              {isUserSpeaking ? "Speaking..." : isMuted ? "Muted" : "Listening"}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center">
          <Button
            variant="destructive"
            size="lg"
            onClick={endSurvey}
            disabled={!isConnected}
            className="transition-all duration-300 hover:scale-105"
          >
            End Survey
          </Button>
        </div>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            {isConnected ? "Connected" : "Connecting..."}
          </p>
        </div>
      </Card>
    </div>
  );
}