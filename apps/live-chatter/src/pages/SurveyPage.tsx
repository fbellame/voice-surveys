import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SimpleSurvey } from '@/components/audio/SimpleSurvey';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import type { User, Session } from '@supabase/supabase-js';

interface Campaign {
  id: number;
  name: string;
  description: string | null;
  campaign_uri: string;
}

interface Lesson {
  id: number;
  name: string;
  description: string | null;
  lesson_uri: string;
}

interface SurveyInvitation {
  id: string;
  campaign_id: number;
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

const SurveyPage = () => {
  const { surveySlug } = useParams<{ surveySlug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [invitation, setInvitation] = useState<SurveyInvitation | null>(null);
  const [campaignLink, setCampaignLink] = useState<CampaignLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [surveyCompleted, setSurveyCompleted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  const rawToken = searchParams.get('token');
  // Handle URL encoding: + signs in URLs become spaces when decoded, so convert them back
  const token = rawToken ? rawToken.replace(/ /g, '+') : null;

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // For anonymous surveys, we don't require authentication
        if (!session && token) {
          // Check if this is an anonymous survey first
          checkAnonymousSurvey();
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session && token) {
        // Check if this is an anonymous survey first
        checkAnonymousSurvey();
      } else {
        // Fetch survey data after auth is confirmed
        setTimeout(() => {
          fetchSurveyData();
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [surveySlug, token, navigate]);

  const checkAnonymousSurvey = async () => {
    if (!surveySlug || !token) return;
    
    try {
      // First, get the campaign
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaign')
        .select('*')
        .eq('campaign_uri', surveySlug)
        .maybeSingle();

      if (campaignError || !campaignData) {
        // If campaign not found, proceed with normal auth flow
        navigate(`/auth?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
      }

      // Check if this is an anonymous campaign link
      const { data: linkData, error: linkError } = await supabase
        .from('campaign_links')
        .select('id, campaign_id, link_type, unique_token, name, description, is_active, max_responses, current_responses, is_anonymous')
        .eq('unique_token', token)
        .eq('campaign_id', campaignData.id)
        .eq('is_active', true)
        .maybeSingle();

      if (linkError || !linkData) {
        // If link not found, proceed with normal auth flow
        navigate(`/auth?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
      }

      if (linkData.is_anonymous) {
        // This is an anonymous survey, allow access without authentication
        console.log('Anonymous survey detected, allowing access without authentication');
        console.log('Campaign data:', campaignData);
        console.log('Link data:', linkData);
        setCampaign(campaignData);
        setCampaignLink(linkData);
        setLoading(false);
      } else {
        // Not anonymous, require authentication
        console.log('Non-anonymous survey detected, requiring authentication');
        navigate(`/auth?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      }
    } catch (error) {
      console.error('Error checking anonymous survey:', error);
      // On error, proceed with normal auth flow
      navigate(`/auth?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  };

  const fetchSurveyData = async () => {
      if (!surveySlug) {
        setError('No survey or lesson specified');
        setLoading(false);
        return;
      }

      // If we already have campaign and campaignLink data from anonymous survey check, skip fetching
      if (campaign && campaignLink) {
        setLoading(false);
        return;
      }

      try {
        // First, try to get a lesson
        const { data: lessonData, error: lessonError } = await supabase
          .from('lesson')
          .select('*')
          .eq('lesson_uri', surveySlug)
          .maybeSingle();

        if (lessonError) {
          console.error('Error fetching lesson:', lessonError);
        }

        if (lessonData) {
          console.log('Found lesson:', lessonData);
          setLesson(lessonData);
          // For lessons, we can proceed without token validation for now
          // (similar to how campaigns work, but lessons might have different auth requirements)
          setLoading(false);
          return;
        }

        // If no lesson found, try to get the campaign
        const { data: campaignData, error: campaignError } = await supabase
          .from('campaign')
          .select('*')
          .eq('campaign_uri', surveySlug)
          .maybeSingle();

        if (campaignError) {
          console.error('Error fetching campaign:', campaignError);
          setError('Failed to load survey');
          setLoading(false);
          return;
        }

        if (!campaignData) {
          setError('Survey or lesson not found');
          setLoading(false);
          return;
        }

        setCampaign(campaignData);

        // If token is provided, validate it
        if (token) {
          console.log('Processing token:', token);
          console.log('Token length:', token.length);
          console.log('Campaign ID:', campaignData.id);
          
          // First try to find a personal invitation
          const { data: invitationData, error: invitationError } = await supabase
            .from('survey_invitations')
            .select('id, campaign_id, unique_token, responded_at, invitation_type, contact_value')
            .eq('unique_token', token)
            .eq('campaign_id', campaignData.id)
            .maybeSingle();

          if (invitationError) {
            console.error('Error fetching invitation:', invitationError);
          }

          if (invitationData) {
            console.log('Found personal invitation:', invitationData);
            
            if (invitationData.responded_at) {
              const completedDate = new Date(invitationData.responded_at).toLocaleDateString();
              setError(`This survey has been completed on ${completedDate}`);
              setLoading(false);
              return;
            }

            setInvitation(invitationData);
            setLoading(false);
            return;
          }

          // If no personal invitation found, try to find a shared campaign link
          const { data: linkData, error: linkError } = await supabase
            .from('campaign_links')
            .select('id, campaign_id, link_type, unique_token, name, description, is_active, max_responses, current_responses, is_anonymous')
            .eq('unique_token', token)
            .eq('campaign_id', campaignData.id)
            .eq('is_active', true)
            .maybeSingle();

          if (linkError) {
            console.error('Error fetching campaign link:', linkError);
          }

          if (linkData) {
            console.log('Found shared campaign link:', linkData);
            
            // Check if the link has reached its maximum responses
            if (linkData.max_responses && linkData.current_responses >= linkData.max_responses) {
              setError('This survey link has reached its maximum number of responses');
              setLoading(false);
              return;
            }

            setCampaignLink(linkData);
            setLoading(false);
            return;
          }

          // If neither found, show error
          console.log('No invitation or link found for token:', token);
          setError('Invalid or expired survey link');
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('Error:', err);
        setError('Failed to load survey');
      } finally {
        setLoading(false);
      }
    };

  const handleComplete = async () => {
    setSurveyCompleted(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <p>Loading survey...</p>
        </Card>
      </div>
    );
  }

  if (error || (!campaign && !lesson)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold">{lesson ? 'Lesson' : 'Survey'} Not Found</h1>
          <p className="text-muted-foreground">{error || `The requested ${lesson ? 'lesson' : 'survey'} could not be found.`}</p>
          <Button onClick={() => navigate('/')} variant="outline" className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Card>
      </div>
    );
  }

  if (surveyCompleted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center space-y-6">
          <div className="mx-auto h-16 w-16 bg-gradient-primary rounded-full flex items-center justify-center mb-6">
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Thank You!</h1>
            <p className="text-muted-foreground">
              {lesson 
                ? `Thank you for completing the lesson "${lesson.name}".`
                : `Thank you for responding to the survey "${campaign?.name}".`}
            </p>
            <p className="text-sm text-muted-foreground">
              {lesson 
                ? "Great job! Keep up the excellent work."
                : "Your participation is greatly appreciated."}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return <SimpleSurvey 
    campaign={campaign || (lesson ? {
      id: lesson.id,
      name: lesson.name,
      description: lesson.description,
      campaign_uri: lesson.lesson_uri
    } : null)}
    invitation={invitation} 
    campaignLink={campaignLink}
    onComplete={handleComplete} 
  />;
};

export default SurveyPage;