import { useState, useEffect, useCallback } from 'react';
import { useLiveKit } from '@/hooks/useLiveKit';
import { generateToken } from '@/utils/token';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mic, MicOff, User, Bot, Check, Link, Mail, X } from 'lucide-react';
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
  email: string | null;
  unique_token: string;
  responded_at: string | null;
  invitation_type: string;
  contact_value: string | null;
}

interface CampaignLink {
  id: string;
  campaign_id: number;
  link_type: string;
  unique_token: string;
  name: string | null;
  description: string | null;
  is_active: boolean;
  max_responses: number | null;
  current_responses: number;
  is_anonymous: boolean;
}

interface SimpleSurveyProps {
  campaign?: Campaign | null;
  invitation?: SurveyInvitation | null;
  campaignLink?: CampaignLink | null;
  onComplete?: () => void;
}

export function SimpleSurvey({ campaign, invitation, campaignLink, onComplete }: SimpleSurveyProps) {
  const [surveyActive, setSurveyActive] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  
  // Debug logging for component props
  console.log('=== SimpleSurvey Component Debug ===');
  console.log('campaign:', campaign);
  console.log('invitation:', invitation);
  console.log('campaignLink:', campaignLink);
  console.log('campaignLink?.is_anonymous:', campaignLink?.is_anonymous);
  console.log('===================================');
  const [currentRoomName, setCurrentRoomName] = useState<string>('');
  const [userInfo, setUserInfo] = useState({
    fullName: '',
    location: '',
    activity: '',
    email: invitation?.contact_value || ''
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

  const handleUserInfoSubmit = async () => {
    // Check if this is an anonymous survey
    const isAnonymous = campaignLink?.is_anonymous || false;
    
    // Debug logging for anonymous survey detection
    console.log('=== ANONYMOUS SURVEY DEBUG ===');
    console.log('campaignLink:', campaignLink);
    console.log('campaignLink?.is_anonymous:', campaignLink?.is_anonymous);
    console.log('isAnonymous:', isAnonymous);
    console.log('userInfo:', userInfo);
    console.log('=============================');
    
    if (isAnonymous) {
      // For anonymous surveys, only require a nickname (full name)
      if (!userInfo.fullName.trim()) {
        toast({
          title: "Missing Information",
          description: "Please provide a nickname to continue",
          variant: "destructive"
        });
        return;
      }
    } else {
      // For non-anonymous surveys, require all fields
      if (!userInfo.fullName.trim() || !userInfo.location.trim() || !userInfo.activity.trim()) {
        toast({
          title: "Missing Information",
          description: "Please fill in all required fields",
          variant: "destructive"
        });
        return;
      }
    }
    
    // Debug: Log user info when form is submitted
    console.log('=== USER INFO SUBMIT DEBUG ===');
    console.log('userInfo submitted:', userInfo);
    console.log('userInfo.fullName:', userInfo.fullName);
    console.log('userInfo.email:', userInfo.email);
    console.log('userInfo.location:', userInfo.location);
    console.log('userInfo.activity:', userInfo.activity);
    console.log('============================');
    
    // Create user profile and survey submission with new table structure
    if (campaign) {
      try {
        // Determine the link token and type
        let linkToken: string;
        let linkType: string;
        let invitationToken: string | null = null;
        
        if (invitation) {
          // Personal invitation
          linkToken = invitation.unique_token;
          linkType = 'personal';
          invitationToken = invitation.unique_token;
        } else if (campaignLink) {
          // Shared campaign link
          linkToken = campaignLink.unique_token;
          linkType = 'generic';
        } else {
          // No link (direct access)
          linkToken = `direct-${Date.now()}`;
          linkType = 'direct';
        }

        // Generate room name using the original campaign_room_mapping pattern
        const { data: roomMapping, error: roomError } = await supabase
          .from('campaign_room_mapping')
          .select('room_pattern')
          .eq('campaign_id', campaign.id)
          .eq('is_active', true)
          .maybeSingle();

        if (roomError) {
          console.error('Error fetching room mapping:', roomError);
        }

        // Generate room name using pattern or fallback (same as original)
        const roomPattern = roomMapping?.room_pattern || 'survey-{timestamp}';
        const baseRoomName = roomPattern.replace('{timestamp}', Date.now().toString());
        const roomName = `${baseRoomName}-${Math.floor(Math.random() * 10000)}`;
        
        console.log('Creating user profile with room name:', roomName);
        console.log('Link token:', linkToken);
        console.log('Link type:', linkType);

        // Step 1: Create user profile
        const isAnonymous = campaignLink?.is_anonymous || false;
        
        const userProfileData = {
          campaign_id: campaign.id,
          full_name: userInfo.fullName || null,
          email: isAnonymous ? null : (userInfo.email || null),
          geography: isAnonymous ? null : (userInfo.location || null),
          occupation: isAnonymous ? null : (userInfo.activity || null),
          phone_number: isAnonymous ? null : (userInfo.email || null), // Using email as phone_number for now
          link_token: linkToken,
          link_type: linkType,
          invitation_token: invitationToken,
          created_at: new Date().toISOString(),
        };

        console.log('Creating user profile with data:', userProfileData);

        const { data: userProfile, error: userProfileError } = await supabase
          .from('user_profiles')
          .insert(userProfileData)
          .select()
          .single();

        if (userProfileError) {
          console.error('Error creating user profile:', userProfileError);
          console.error('Error details:', {
            message: userProfileError.message,
            details: userProfileError.details,
            hint: userProfileError.hint,
            code: userProfileError.code
          });
          console.error('Data that failed to insert:', userProfileData);
          toast({
            title: "Error",
            description: "Failed to create user profile",
            variant: "destructive"
          });
          return;
        }

        console.log('User profile created successfully:', userProfile);

        // Step 2: Create survey submission linked to user profile
        const surveySubmissionData = {
          campaign_id: campaign.id,
          user_profile_id: userProfile.id,
          room_name: roomName,
          link_token: linkToken,
          link_type: linkType,
          created_at: new Date().toISOString(),
        };

        console.log('Creating survey submission with data:', surveySubmissionData);

        const { error: submissionError } = await supabase
          .from('survey_submissions')
          .insert(surveySubmissionData);

        if (submissionError) {
          console.error('Error creating survey submission:', submissionError);
          console.error('Error details:', {
            message: submissionError.message,
            details: submissionError.details,
            hint: submissionError.hint,
            code: submissionError.code
          });
          console.error('Data that failed to insert:', surveySubmissionData);
          toast({
            title: "Error",
            description: "Failed to create survey submission",
            variant: "destructive"
          });
          return;
        }

        console.log('Survey submission created successfully');
        // Store the room name for later use
        setCurrentRoomName(roomName);
        
        setShowUserForm(false);
        // Pass the room name directly to startSurvey
        startSurvey(roomName);
        return; // Exit early since we're calling startSurvey
        
      } catch (error) {
        console.error('Error creating user profile and submission:', error);
        toast({
          title: "Error",
          description: "Failed to create user profile and survey submission",
          variant: "destructive"
        });
        return;
      }
    }
    
    setShowUserForm(false);
    startSurvey();
  };

  const startSurvey = async (roomName: string = '') => {
    try {
      console.log('Starting survey with invitation:', invitation);
      console.log('Starting survey with campaign link:', campaignLink);
      console.log('Campaign:', campaign);
      console.log('User info at start:', userInfo);
      console.log('Room name parameter:', roomName);
      console.log('Current room name (from state):', currentRoomName);
      
      // Use the passed room name or fall back to the state
      const finalRoomName = roomName || currentRoomName;
      
      if (!finalRoomName) {
        console.error('No room name available - submission was not created properly');
        toast({
          title: "Error",
          description: "Failed to start survey - no room name available",
          variant: "destructive"
        });
        return;
      }
      
      // Use the room name that was already created with the submission
      const userName = `user-${Math.floor(Math.random() * 10000)}`;
      
      console.log('Using room name:', finalRoomName);
      console.log('User name:', userName);
      
      const token = await generateToken(finalRoomName, userName);
      await joinRoom(finalRoomName, userName, token);
      setCurrentRoomName(finalRoomName);
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
    
    // Debug: Log userInfo state
    console.log('=== SURVEY END DEBUG ===');
    console.log('userInfo state at survey end:', userInfo);
    console.log('userInfo.fullName:', userInfo.fullName);
    console.log('userInfo.email:', userInfo.email);
    console.log('userInfo.location:', userInfo.location);
    console.log('userInfo.activity:', userInfo.activity);
    console.log('currentRoomName:', currentRoomName);
    console.log('campaign:', campaign);
    console.log('invitation:', invitation);
    console.log('campaignLink:', campaignLink);
    console.log('========================');
    
    // Update the existing survey submission with completion data
    if (campaign && currentRoomName) {
      try {
        // Find the existing submission for this room
        const { data: existingSubmission, error: checkError } = await supabase
          .from('survey_submissions')
          .select('id, user_profile_id')
          .eq('room_name', currentRoomName)
          .maybeSingle();

        if (checkError) {
          console.error('Error checking existing submission:', checkError);
        }

        if (existingSubmission) {
          console.log('Found existing submission:', existingSubmission);
          
          // Update the submission with completion timestamp and any additional data
          const updateData = {
            call_timestamp: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          // Debug: Log update data
          console.log('=== UPDATE DATA DEBUG ===');
          console.log('updateData:', updateData);
          console.log('========================');

          const { error: updateError } = await supabase
            .from('survey_submissions')
            .update(updateData)
            .eq('id', existingSubmission.id);

          if (updateError) {
            console.error('Error updating survey submission:', updateError);
            throw updateError;
          }
          console.log('Survey completion data updated successfully:', updateData);
        } else {
          console.error('No existing submission found for room:', currentRoomName);
        }

        // If this was a personal invitation, mark it as responded
        if (invitation && invitation.unique_token) {
          console.log('Updating invitation responded_at for token:', invitation.unique_token);
          
          const timestamp = new Date().toISOString();
          
          const { data: updateData, error: invitationError } = await supabase
            .rpc('update_invitation_responded_at', {
              token: invitation.unique_token,
              responded_timestamp: timestamp
            });

          if (invitationError) {
            console.error('Error updating invitation:', invitationError);
          } else {
            console.log('Successfully updated invitation responded_at');
          }
        }
      } catch (error) {
        console.error('Error updating survey data:', error);
      }
    }
    
    toast({
      title: "Survey Closing",
      description: "Thank you for participating",
    });
    
    if (onComplete) {
      onComplete();
    }
  }, [leaveRoom, campaign, currentRoomName, userInfo, invitation, campaignLink, onComplete, toast]);

  // Auto-complete survey when AI agent sends closing status
  useEffect(() => {
    if (surveyProgress.status === 'closing' && surveyActive && isConnected && !isAutoCompleting) {
      console.log('=== AUTO-COMPLETION DEBUG ===');
      console.log('Survey closing status received from AI agent, automatically ending survey...');
      console.log('Invitation object at auto-completion:', invitation);
      console.log('Campaign link object at auto-completion:', campaignLink);
      console.log('Survey progress:', surveyProgress);
      console.log('userInfo state at auto-completion:', userInfo);
      console.log('userInfo.fullName at auto-completion:', userInfo.fullName);
      console.log('userInfo.email at auto-completion:', userInfo.email);
      console.log('userInfo.location at auto-completion:', userInfo.location);
      console.log('userInfo.activity at auto-completion:', userInfo.activity);
      console.log('currentRoomName at auto-completion:', currentRoomName);
      console.log('============================');
      setIsAutoCompleting(true);
      // Add a small delay to ensure all data is processed
      setTimeout(() => {
        endSurvey();
      }, 1000);
    }
  }, [surveyProgress.status, surveyActive, isConnected, endSurvey, isAutoCompleting, invitation, campaignLink, userInfo, currentRoomName]);

  if (!surveyActive && !isConnected) {
    if (showUserForm || invitation || campaignLink) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-8 space-y-6">
            <div className="mx-auto h-16 w-16 bg-gradient-primary rounded-full flex items-center justify-center mb-6">
              {invitation ? <Mail className="h-8 w-8 text-white" /> : <Link className="h-8 w-8 text-white" />}
            </div>
            
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-bold">
                {campaign?.name || "Survey"}
              </h1>
              {campaignLink?.is_anonymous && (
                <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  Anonymous Survey
                </div>
              )}
              <p className="text-muted-foreground">
                {campaignLink?.is_anonymous 
                  ? "This is an anonymous survey. Only a nickname is required."
                  : "Please provide your information to begin"
                }
              </p>
              {invitation && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Personal invitation
                  </p>
                  {invitation.contact_value && (
                    <p className="text-xs text-muted-foreground">
                      Contact: {invitation.contact_value}
                    </p>
                  )}
                </div>
              )}
              {campaignLink && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Shared survey link
                  </p>
                  {campaignLink.name && (
                    <p className="text-xs text-muted-foreground">
                      {campaignLink.name}
                    </p>
                  )}
                  {campaignLink.description && (
                    <p className="text-xs text-muted-foreground">
                      {campaignLink.description}
                    </p>
                  )}
                  {campaignLink.max_responses && (
                    <p className="text-xs text-muted-foreground">
                      Responses: {campaignLink.current_responses}/{campaignLink.max_responses}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {campaignLink?.is_anonymous ? (
                // Anonymous survey - only show nickname field
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nickname *</Label>
                  <Input
                    id="fullName"
                    value={userInfo.fullName}
                    onChange={(e) => setUserInfo({...userInfo, fullName: e.target.value})}
                    placeholder="Enter a nickname (e.g., John, SurveyUser123)"
                    className="bg-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    This survey is anonymous. Only a nickname is required.
                  </p>
                </div>
              ) : (
                // Non-anonymous survey - show all fields
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={userInfo.email}
                      disabled={!!invitation?.contact_value}
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
                </>
              )}
            </div>

            <Button 
              onClick={handleUserInfoSubmit}
              disabled={isConnecting}
              className="w-full"
              variant="audio"
              size="lg"
            >
              {isConnecting ? "Starting..." : (surveyProgress.isLessonMode ? "Start Lesson" : "Start Survey")}
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
            {isConnecting ? "Starting..." : (surveyProgress.isLessonMode ? "Start Lesson" : "Start Survey")}
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
            {campaign?.name || (surveyProgress.isLessonMode ? "Lesson" : "Survey")} in Progress
          </h2>
          <p className="text-muted-foreground">
            {surveyProgress.isLessonMode 
              ? "Please wait while your AI teacher speaks..." 
              : "Please wait while the voice assistant speaks..."}
          </p>
        </div>

        {/* Survey/Lesson Progress */}
        {surveyProgress.totalQuestions > 0 && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">
                {surveyProgress.isLessonMode ? "Lesson Progress" : "Survey Progress"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {getProgressStats().completed} of {getProgressStats().total} questions answered ({getProgressStats().percentage}%)
              </p>
              
              {/* Lesson Mode Performance */}
              {surveyProgress.isLessonMode && surveyProgress.totalPoints > 0 && (
                <div className="mt-4 p-4 bg-accent/50 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Score:</span>
                    <span className="font-semibold">
                      {surveyProgress.pointsEarned}/{surveyProgress.totalPoints} points
                      {surveyProgress.totalPoints > 0 && (
                        <span className="ml-2">
                          ({Math.round((surveyProgress.pointsEarned / surveyProgress.totalPoints) * 100)}%)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Correct Answers:</span>
                    <span className="font-semibold">
                      {surveyProgress.correctAnswers}/{surveyProgress.totalQuestions}
                    </span>
                  </div>
                </div>
              )}
              
              {/* Quiz Question Indicator */}
              {surveyProgress.isLessonMode && surveyProgress.isQuizQuestion && (
                <div className="mt-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary">
                    Quiz Question
                  </span>
                </div>
              )}
              
              {/* Last Answer Feedback (Lesson Mode) */}
              {surveyProgress.isLessonMode && surveyProgress.lastAnswerCorrect !== undefined && (
                <div className={`mt-4 p-4 rounded-lg ${
                  surveyProgress.lastAnswerCorrect 
                    ? 'bg-green-500/20 border border-green-500/50' 
                    : 'bg-orange-500/20 border border-orange-500/50'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {surveyProgress.lastAnswerCorrect ? (
                      <>
                        <Check className="h-5 w-5 text-green-600" />
                        <span className="font-semibold text-green-700">Correct!</span>
                      </>
                    ) : (
                      <>
                        <X className="h-5 w-5 text-orange-600" />
                        <span className="font-semibold text-orange-700">Not quite right</span>
                      </>
                    )}
                  </div>
                  {surveyProgress.encouragementMessage && (
                    <p className="text-sm text-muted-foreground">
                      {surveyProgress.encouragementMessage}
                    </p>
                  )}
                </div>
              )}
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
            {surveyProgress.isLessonMode ? "End Lesson" : "End Survey"}
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