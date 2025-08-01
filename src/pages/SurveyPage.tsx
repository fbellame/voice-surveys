import { useParams, useNavigate } from 'react-router-dom';
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
}

const SurveyPage = () => {
  const { surveySlug } = useParams<{ surveySlug: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCampaign = async () => {
      if (!surveySlug) {
        setError('No survey specified');
        setLoading(false);
        return;
      }

      try {
        // First try exact slug match (for names that are already URL-friendly)
        let { data, error: fetchError } = await supabase
          .from('campaign')
          .select('*')
          .eq('name', surveySlug)
          .maybeSingle();

        // If no exact match, try converting slug back to name with spaces
        if (!data && !fetchError) {
          const campaignName = surveySlug.replace(/-/g, ' ');
          
          const result = await supabase
            .from('campaign')
            .select('*')
            .ilike('name', campaignName)
            .maybeSingle();
            
          data = result.data;
          fetchError = result.error;
        }

        if (fetchError) {
          console.error('Error fetching campaign:', fetchError);
          setError('Failed to load survey');
        } else if (!data) {
          setError('Survey not found');
        } else {
          setCampaign(data);
        }
      } catch (err) {
        console.error('Error:', err);
        setError('Failed to load survey');
      } finally {
        setLoading(false);
      }
    };

    fetchCampaign();
  }, [surveySlug]);

  const handleComplete = () => {
    navigate('/');
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

  return <SimpleSurvey campaign={campaign} onComplete={handleComplete} />;
};

export default SurveyPage;