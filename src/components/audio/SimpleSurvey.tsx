import { useState, useEffect } from 'react';
import { useLiveKit } from '@/hooks/useLiveKit';
import { generateToken } from '@/utils/token';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mic, MicOff, User, Bot } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface Campaign {
  id: number;
  name: string;
  description: string | null;
  campaign_uri: string;
}

interface SurveyInvitation {
  id: string;
  campaign_id: number;
  email: string;
  unique_token: string;
  responded_at: string | null;
}

interface SimpleSurveyProps {
  campaign?: Campaign | null;
  invitation?: SurveyInvitation | null;
  onComplete?: () => void;
}

export function SimpleSurvey({ campaign, invitation, onComplete }: SimpleSurveyProps) {
  const [surveyActive, setSurveyActive] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [currentRoomName, setCurrentRoomName] = useState<string>('');
  const [userInfo, setUserInfo] = useState({
    fullName: '',
    location: '',
    activity: '',
    email: invitation?.email || ''
  });
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const { toast } = useToast();

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
    });
  }, []);
  
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
  const localUser = participants.find(p => p.participant.isLocal);
  const isAgentSpeaking = agent?.isSpeaking || false;
  const isUserSpeaking = localUser?.isSpeaking || false;

  const handleUserInfoSubmit = () => {
    if (!userInfo.fullName.trim() || !userInfo.location.trim() || !userInfo.activity.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }
    setShowUserForm(false);
    startSurvey();
  };

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
      const baseRoomName = roomPattern.replace('{timestamp}', Date.now().toString());
      const roomName = `${baseRoomName}-${Math.floor(Math.random() * 10000)}`;
      const userName = `user-${Math.floor(Math.random() * 10000)}`;
      
      const token = await generateToken(roomName, userName);
      await joinRoom(roomName, userName, token);
      setCurrentRoomName(roomName);
      setSurveyActive(true);
      
      toast({
        title: "Survey Started",
        description: "Your survey session has begun",
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
    
    // Find and update agent-created survey response instead of creating a new one
    if (currentUser && campaign && currentRoomName) {
      try {
        // Get all survey responses for this room and campaign
        const { data: existingResponses, error: fetchError } = await supabase
          .from('survey_response')
          .select('*')
          .eq('room_name', currentRoomName)
          .eq('campaign_id', campaign.id);

        if (fetchError) {
          console.error('Error fetching survey responses:', fetchError);
          return;
        }

        // Find the agent-created record (null user_id and null invitation_token)
        const agentRecord = existingResponses?.find(r => !r.user_id && !r.invitation_token);
        
        if (agentRecord) {
          // Update the agent-created record with user data
          const { error: updateError } = await supabase
            .from('survey_response')
            .update({
              user_id: currentUser.id,
              phone_number: userInfo.email,
              invitation_token: invitation?.unique_token,
              updated_at: new Date().toISOString()
            })
            .eq('id', agentRecord.id);

          if (updateError) {
            console.error('Error updating agent survey response:', updateError);
          }
        } else {
          // No agent record found, create new response
          await supabase
            .from('survey_response')
            .insert({
              campaign_id: campaign.id,
              user_id: currentUser.id,
              phone_number: userInfo.email,
              room_name: currentRoomName,
              invitation_token: invitation?.unique_token
            });
        }

        // Update invitation status if this was from an invitation
        if (invitation) {
          await supabase
            .from('survey_invitations')
            .update({ 
              responded_at: new Date().toISOString(),
              user_id: currentUser.id 
            })
            .eq('unique_token', invitation.unique_token);
        }
      } catch (error) {
        console.error('Error saving survey response:', error);
      }
    }
    
    toast({
      title: "Survey Completed",
      description: "Thank you for participating",
    });
    
    if (onComplete) {
      onComplete();
    }
  };

  if (!surveyActive && !isConnected) {
    if (showUserForm || invitation) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-8 space-y-6">
            <div className="mx-auto h-16 w-16 bg-gradient-primary rounded-full flex items-center justify-center mb-6">
              <Bot className="h-8 w-8 text-white" />
            </div>
            
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-bold">
                {campaign?.name || "Survey"}
              </h1>
              <p className="text-muted-foreground">
                Please provide your information to begin
              </p>
              {invitation && (
                <p className="text-sm text-muted-foreground">
                  Private invitation for: {invitation.email}
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={userInfo.email}
                  disabled={!!invitation}
                  onChange={(e) => setUserInfo({...userInfo, email: e.target.value})}
                  placeholder="your@email.com"
                  className="bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  value={userInfo.fullName}
                  onChange={(e) => setUserInfo({...userInfo, fullName: e.target.value})}
                  placeholder="Enter your full name"
                  className="bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <Input
                  id="location"
                  value={userInfo.location}
                  onChange={(e) => setUserInfo({...userInfo, location: e.target.value})}
                  placeholder="Enter your location"
                  className="bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="activity">Activity *</Label>
                <Input
                  id="activity"
                  value={userInfo.activity}
                  onChange={(e) => setUserInfo({...userInfo, activity: e.target.value})}
                  placeholder="Enter your activity/profession"
                  className="bg-background"
                />
              </div>
            </div>

            <Button 
              onClick={handleUserInfoSubmit}
              disabled={isConnecting}
              className="w-full"
              variant="audio"
              size="lg"
            >
              {isConnecting ? "Starting..." : "Start Survey"}
            </Button>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center space-y-6">
          <div className="mx-auto h-16 w-16 bg-gradient-primary rounded-full flex items-center justify-center mb-6">
            <Bot className="h-8 w-8 text-white" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">
              {campaign?.name || "Survey"}
            </h1>
            <p className="text-muted-foreground">
              {campaign?.description || "Participate in an AI-powered survey"}
            </p>
          </div>

          <Button 
            onClick={() => setShowUserForm(true)}
            disabled={isConnecting}
            className="w-full"
            variant="audio"
            size="lg"
          >
            {isConnecting ? "Starting..." : "Start Survey"}
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