import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SimpleSurvey } from '@/components/audio/SimpleSurvey';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

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

  const token = searchParams.get('token');
  console.log('Raw token from URL:', token);
  console.log('Decoded token:', token ? decodeURIComponent(token) : null);

  useEffect(() => {
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
          const { data: invitationData, error: invitationError } = await (supabase as any)
            .from('survey_invitations')
            .select('id, campaign_id, email, unique_token, responded_at')
            .eq('unique_token', token)
            .eq('campaign_id', campaignData.id)
            .maybeSingle();

          if (invitationError) {
            console.error('Error fetching invitation:', invitationError);
            setError('Invalid survey link');
            setLoading(false);
            return;
          }

          if (!invitationData) {
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

    fetchSurveyData();
  }, [surveySlug, token]);

  const handleComplete = async () => {
    // Update invitation status if token was used
    if (invitation && token) {
      try {
        await (supabase as any)
          .from('survey_invitations')
          .update({ responded_at: new Date().toISOString() })
          .eq('unique_token', token);
      } catch (err) {
        console.error('Error updating invitation status:', err);
      }
    }
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