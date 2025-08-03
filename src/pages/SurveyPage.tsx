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

interface SurveyInvitation {
  id: string;
  campaign_id: number;
  email: string;
  unique_token: string;
  responded_at: string | null;
}

const SurveyPage = () => {
  const { surveySlug } = useParams<{ surveySlug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [invitation, setInvitation] = useState<SurveyInvitation | null>(null);
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
        
        if (!session && token) {
          // If no session but there's a token, redirect to auth with return URL
          navigate(`/auth?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session && token) {
        navigate(`/auth?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      } else {
        // Fetch survey data after auth is confirmed
        setTimeout(() => {
          fetchSurveyData();
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [surveySlug, token, navigate]);

  const fetchSurveyData = async () => {
      if (!surveySlug) {
        setError('No survey specified');
        setLoading(false);
        return;
      }

      try {
        // First, get the campaign
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
          setError('Survey not found');
          setLoading(false);
          return;
        }

        setCampaign(campaignData);

        // If token is provided, validate it
        if (token) {
          console.log('Processing token:', token);
          console.log('Token length:', token.length);
          console.log('Campaign ID:', campaignData.id);
          
          const { data: invitationData, error: invitationError } = await (supabase as any)
            .from('survey_invitations')
            .select('id, campaign_id, email, unique_token, responded_at')
            .eq('unique_token', token)
            .eq('campaign_id', campaignData.id)
            .maybeSingle();

          console.log('Invitation query result:', invitationData);
          console.log('Invitation query error:', invitationError);

          if (invitationError) {
            console.error('Error fetching invitation:', invitationError);
            setError('Invalid survey link');
            setLoading(false);
            return;
          }

          if (!invitationData) {
            console.log('No invitation data found. Trying broader search...');
            
            // Try to find any token that matches (debugging)
            const { data: allTokens } = await (supabase as any)
              .from('survey_invitations')
              .select('unique_token, campaign_id')
              .eq('campaign_id', campaignData.id);
            
            console.log('All tokens for this campaign:', allTokens);
            
            setError('Invalid or expired survey link');
            setLoading(false);
            return;
          }

          if (invitationData.responded_at) {
            const completedDate = new Date(invitationData.responded_at).toLocaleDateString();
            setError(`This survey has been completed on ${completedDate}`);
            setLoading(false);
            return;
          }

          setInvitation(invitationData);
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

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold">Survey Not Found</h1>
          <p className="text-muted-foreground">{error || 'The requested survey could not be found.'}</p>
          <Button onClick={() => navigate('/')} variant="outline" className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Survey List
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
              Thank you for responding to the survey "{campaign?.name}".
            </p>
            <p className="text-sm text-muted-foreground">
              Your participation is greatly appreciated.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return <SimpleSurvey campaign={campaign} invitation={invitation} onComplete={handleComplete} />;
};

export default SurveyPage;