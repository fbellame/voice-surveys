import { useState, useEffect, useCallback } from 'react';
import { useLiveKit } from '@/hooks/useLiveKit';
import { generateToken } from '@/utils/token';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mic, MicOff, User, Bot, Check } from 'lucide-react';
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
  const [isAutoCompleting, setIsAutoCompleting] = useState(false);
  const { toast } = useToast();

  const {
    isConnected,
    isConnecting,
    participants,
    isMuted,
    toggleMute,
    joinRoom,
    leaveRoom,
    // New survey tracking
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
      console.log('Starting survey with invitation:', invitation);
      console.log('Campaign:', campaign);
      
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
      
      console.log('Generated room name:', roomName);
      console.log('User name:', userName);
      
      const token = await generateToken(roomName, userName);
      await joinRoom(roomName, userName, token);
      setCurrentRoomName(roomName);
      setSurveyActive(true);
      
      toast({
        title: "Survey Started",
        description: "Your survey session has begun",
      });
    } catch (err) {
      console.error('Error starting survey:', err);
      toast({
        title: "Failed to Start Survey",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  const endSurvey = useCallback(async () => {
    await leaveRoom();
    setSurveyActive(false);
    setIsAutoCompleting(false); // Reset auto-completion flag
    
    // Check if submission already exists and update it, otherwise create new one
    if (campaign && currentRoomName) {
      try {
        // First check if a submission already exists for this room
        const { data: existingSubmission, error: checkError } = await supabase
          .from('survey_submissions')
          .select('id')
          .eq('room_name', currentRoomName)
          .maybeSingle();

        if (checkError) {
          console.error('Error checking existing submission:', checkError);
        }

        const submissionData = {
          campaign_id: campaign.id,
          full_name: userInfo.fullName,
          email: userInfo.email,
          geography: userInfo.location,
          occupation: userInfo.activity,
          phone_number: userInfo.email, // Using email as phone_number for now
          room_name: currentRoomName,
          invitation_token: invitation?.unique_token || null,
          updated_at: new Date().toISOString(),
        };

        if (existingSubmission) {
          // Update existing submission with user data
          const { error: updateError } = await supabase
            .from('survey_submissions')
            .update(submissionData)
            .eq('id', existingSubmission.id);

          if (updateError) {
            console.error('Error updating survey submission:', updateError);
            throw updateError;
          }
          console.log('Survey data updated successfully:', submissionData);
        } else {
          // Create new submission
          const { error: insertError } = await supabase
            .from('survey_submissions')
            .insert(submissionData);

          if (insertError) {
            console.error('Error creating survey submission:', insertError);
            throw insertError;
          }
          console.log('Survey data created successfully:', submissionData);
        }

        // If this was an invitation-based survey, mark it as responded
        if (invitation && invitation.unique_token) {
          console.log('Updating invitation responded_at for token:', invitation.unique_token);
          console.log('Invitation object:', invitation);
          
          // Use RPC call to bypass RLS restriction for this specific update
          // This is a workaround for the RLS policy that prevents anonymous updates
          const timestamp = new Date().toISOString();
          
          const { data: updateData, error: invitationError } = await supabase
            .rpc('update_invitation_responded_at', {
              token: invitation.unique_token,
              responded_timestamp: timestamp
            });

          console.log('Update result data:', updateData);
          console.log('Update result error:', invitationError);

          if (invitationError) {
            console.error('Error updating invitation:', invitationError);
          } else {
            console.log('Successfully updated invitation responded_at');
            
            // Verify the update worked by re-querying
            const { data: verifyData, error: verifyError } = await supabase
              .from('survey_invitations')
              .select('responded_at')
              .eq('unique_token', invitation.unique_token)
              .single();
              
            console.log('Verification query result:', verifyData);
            console.log('Verification query error:', verifyError);
          }
        } else {
          console.log('No invitation object or token found - trying fallback method');
          
          // Fallback: try to find invitation by the token we stored in submission
          if (submissionData.invitation_token) {
            console.log('Attempting fallback update with token:', submissionData.invitation_token);
            
            const timestamp = new Date().toISOString();
            
            const { data: fallbackData, error: fallbackError } = await supabase
              .rpc('update_invitation_responded_at', {
                token: submissionData.invitation_token,
                responded_timestamp: timestamp
              });

            console.log('Fallback update result data:', fallbackData);
            console.log('Fallback update result error:', fallbackError);

            if (fallbackError) {
              console.error('Error in fallback invitation update:', fallbackError);
            } else {
              console.log('Successfully updated invitation via fallback method');
              
              // Verify fallback update
              const { data: fallbackVerifyData, error: fallbackVerifyError } = await supabase
                .from('survey_invitations')
                .select('responded_at')
                .eq('unique_token', submissionData.invitation_token)
                .single();
                
              console.log('Fallback verification result:', fallbackVerifyData);
              console.log('Fallback verification error:', fallbackVerifyError);
            }
          } else {
            console.log('No invitation token available for fallback update');
          }
        }
      } catch (error) {
        console.error('Error saving survey data:', error);
      }
    }
    
    toast({
      title: "Survey Closing",
      description: "Thank you for participating",
    });
    
    if (onComplete) {
      onComplete();
    }
  }, [leaveRoom, campaign, currentRoomName, userInfo, invitation, onComplete, toast]);

  // Auto-complete survey when AI agent sends closing status
  useEffect(() => {
    if (surveyProgress.status === 'closing' && surveyActive && isConnected && !isAutoCompleting) {
      console.log('Survey closing status received from AI agent, automatically ending survey...');
      console.log('Invitation object at auto-completion:', invitation);
      console.log('Survey progress:', surveyProgress);
      setIsAutoCompleting(true);
      // Add a small delay to ensure all data is processed
      setTimeout(() => {
        endSurvey();
      }, 1000);
    }
  }, [surveyProgress.status, surveyActive, isConnected, endSurvey, isAutoCompleting, invitation]);

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

        {/* Survey Progress */}
        {surveyProgress.totalQuestions > 0 && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Survey Progress</h3>
              <p className="text-sm text-muted-foreground">
                {getProgressStats().completed} of {getProgressStats().total} questions answered ({getProgressStats().percentage}%)
              </p>
            </div>
            
            {/* Current Question */}
            {getCurrentQuestion().text && (
              <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-primary">
                    Question {getCurrentQuestion().number || '1'}:
                  </span>
                  {getCurrentQuestion().isAnswered && (
                    <div className="h-5 w-5 bg-green-500 rounded-full flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>
                <p className="text-sm">
                  {getCurrentQuestion().text && getCurrentQuestion().text.length > 100 
                    ? `${getCurrentQuestion().text.substring(0, 100)}...` 
                    : getCurrentQuestion().text}
                </p>
                {surveyProgress.lastAnswer && (
                  <div className="mt-2 pt-2 border-t border-border/50">
                    <span className="text-xs font-medium text-muted-foreground">Last Answer:</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      {surveyProgress.lastAnswer.length > 80 
                        ? `${surveyProgress.lastAnswer.substring(0, 80)}...` 
                        : surveyProgress.lastAnswer}
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* Progress Bar */}
            <div className="bg-secondary/30 rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-500"
                style={{ width: `${getProgressStats().percentage}%` }}
              />
            </div>
          </div>
        )}

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