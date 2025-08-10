import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Settings, BarChart3, Users, Mail, Link, Calendar, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CampaignLinkManager } from '@/components/audio/CampaignLinkManager';
import { InvitationManager } from '@/components/audio/InvitationManager';
import type { Database } from '@/integrations/supabase/types';

type Campaign = Database['public']['Tables']['campaign']['Row'];
type SurveySubmission = Database['public']['Tables']['survey_submissions']['Row'] & {
  user_profiles?: {
    full_name: string | null;
    email: string | null;
    geography: string | null;
    occupation: string | null;
    phone_number: string | null;
  } | null;
};

export default function CampaignManagement() {
  const { campaignUri } = useParams<{ campaignUri: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [submissions, setSubmissions] = useState<SurveySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (campaignUri) {
      fetchCampaign();
      fetchSubmissions();
    }
  }, [campaignUri]);

  const fetchCampaign = async () => {
    try {
      const { data, error } = await supabase
        .from('campaign')
        .select('*')
        .eq('campaign_uri', campaignUri)
        .single();

      if (error) {
        console.error('Error fetching campaign:', error);
        toast({
          title: "Error",
          description: "Failed to fetch campaign details",
          variant: "destructive"
        });
        navigate('/');
      } else {
        setCampaign(data);
      }
    } catch (err) {
      console.error('Error:', err);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissions = async () => {
    if (!campaignUri) return;

    try {
      const { data, error } = await supabase
        .from('survey_submissions')
        .select(`
          *,
          user_profiles (
            full_name,
            email,
            geography,
            occupation,
            phone_number
          )
        `)
        .eq('campaign_id', campaign?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching submissions:', error);
      } else {
        setSubmissions(data || []);
      }
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleRefresh = () => {
    fetchSubmissions();
  };

  const getSubmissionStats = () => {
    const total = submissions.length;
    const byLinkType = submissions.reduce((acc, sub) => {
      const type = sub.link_type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byDate = submissions.reduce((acc, sub) => {
      const date = new Date(sub.created_at!).toDateString();
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { total, byLinkType, byDate };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Card className="p-8 text-center">
            <h2 className="text-2xl font-semibold mb-4">Campaign Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The campaign you're looking for doesn't exist or has been removed.
            </p>
            <Button onClick={() => navigate('/')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const stats = getSubmissionStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Campaigns
          </Button>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {campaign.name}
              </h1>
              {campaign.description && (
                <p className="text-lg text-gray-600 mb-4">
                  {campaign.description}
                </p>
              )}
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <div className="flex items-center">
                  <Calendar className="mr-1 h-4 w-4" />
                  Created: {new Date(campaign.created_at!).toLocaleDateString()}
                </div>
                {campaign.start_date && (
                  <div className="flex items-center">
                    <Calendar className="mr-1 h-4 w-4" />
                    Start: {new Date(campaign.start_date).toLocaleDateString()}
                  </div>
                )}
                {campaign.end_date && (
                  <div className="flex items-center">
                    <Calendar className="mr-1 h-4 w-4" />
                    End: {new Date(campaign.end_date).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Badge variant="outline">
                {campaign.campaign_type}
              </Badge>
              <Button
                variant="outline"
                onClick={() => navigate(`/${campaign.campaign_uri}`)}
              >
                <Users className="mr-2 h-4 w-4" />
                View Survey
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="links" className="flex items-center space-x-2">
              <Link className="h-4 w-4" />
              <span>Campaign Links</span>
            </TabsTrigger>
            <TabsTrigger value="invitations" className="flex items-center space-x-2">
              <Mail className="h-4 w-4" />
              <span>Personal Invitations</span>
            </TabsTrigger>
            <TabsTrigger value="responses" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Responses</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Responses</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Link className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Campaign Links</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.byLinkType.generic || 0}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <Mail className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Personal Invitations</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.byLinkType.personal || 0}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
                {submissions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No responses yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {submissions.slice(0, 5).map((submission) => (
                      <div key={submission.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <div>
                            <p className="font-medium">{submission.user_profiles?.full_name || 'Anonymous'}</p>
                            <p className="text-sm text-muted-foreground">
                              {submission.user_profiles?.geography || 'No location'} • {submission.user_profiles?.occupation || 'No occupation'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {new Date(submission.created_at!).toLocaleDateString()}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {submission.link_type || 'unknown'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Campaign Details</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Campaign Type</p>
                    <p className="text-gray-900">{campaign.campaign_type}</p>
                  </div>
                  {campaign.intro_prompt && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Intro Prompt</p>
                      <p className="text-gray-900 text-sm">{campaign.intro_prompt}</p>
                    </div>
                  )}
                  {campaign.greeting && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Greeting</p>
                      <p className="text-gray-900 text-sm">{campaign.greeting}</p>
                    </div>
                  )}
                  {campaign.closing && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Closing</p>
                      <p className="text-gray-900 text-sm">{campaign.closing}</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Campaign Links Tab */}
          <TabsContent value="links" className="space-y-6">
            {campaign && <CampaignLinkManager campaign={campaign} onRefresh={handleRefresh} />}
          </TabsContent>

          {/* Personal Invitations Tab */}
          <TabsContent value="invitations" className="space-y-6">
            {campaign && <InvitationManager campaign={campaign} onRefresh={handleRefresh} />}
          </TabsContent>

          {/* Responses Tab */}
          <TabsContent value="responses" className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Survey Responses</h3>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">
                    Total: {submissions.length}
                  </Badge>
                </div>
              </div>

              {submissions.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h4 className="text-lg font-semibold mb-2">No Responses Yet</h4>
                  <p className="text-muted-foreground">
                    Start sharing your campaign to collect responses
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {submissions.map((submission) => (
                    <Card key={submission.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center space-x-3">
                            <h4 className="font-medium">
                              {submission.user_profiles?.full_name || 'Anonymous'}
                            </h4>
                            <Badge variant="outline" className="text-xs">
                              {submission.link_type || 'unknown'}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                            {submission.user_profiles?.email && (
                              <div>
                                <span className="font-medium">Email:</span> {submission.user_profiles.email}
                              </div>
                            )}
                            {submission.user_profiles?.geography && (
                              <div>
                                <span className="font-medium">Location:</span> {submission.user_profiles.geography}
                              </div>
                            )}
                            {submission.user_profiles?.occupation && (
                              <div>
                                <span className="font-medium">Occupation:</span> {submission.user_profiles.occupation}
                              </div>
                            )}
                            {submission.room_name && (
                              <div>
                                <span className="font-medium">Room:</span> {submission.room_name}
                              </div>
                            )}
                          </div>
                          
                          <div className="text-xs text-muted-foreground">
                            Submitted: {new Date(submission.created_at!).toLocaleString()}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Navigate to survey with this submission context
                              navigate(`/${campaign.campaign_uri}?submission=${submission.id}`);
                            }}
                          >
                            <User className="h-4 w-4" />
                            View
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
