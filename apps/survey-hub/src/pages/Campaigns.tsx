import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { StatsCard } from "@/components/StatsCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  BarChart3, 
  Phone, 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Play,
  Pause,
  Calendar,
  Link
} from "lucide-react";
import { SurveyInvitations } from "@/components/SurveyInvitations";
import { CampaignLinks } from "@/components/CampaignLinks";

interface CampaignWithStats {
  id: number;
  name: string;
  description: string | null;
  campaign_uri: string | null;
  start_date: string | null;
  end_date: string | null;
  status: "active" | "draft" | "completed";
  questions: number;
  answers: number;
}

export default function Campaigns() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaignForInvitations, setSelectedCampaignForInvitations] = useState<CampaignWithStats | null>(null);
  const [selectedCampaignForLinks, setSelectedCampaignForLinks] = useState<CampaignWithStats | null>(null);

  useEffect(() => {
    const fetchCampaigns = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      
      try {
        // Fetch campaigns with their related data
        const { data: campaignsData, error: campaignsError } = await supabase
          .from('campaign')
          .select('*')
          .eq('user_id', user?.id);

        if (campaignsError) throw campaignsError;

        // Fetch question counts per campaign
        const { data: questionCounts, error: questionError } = await supabase
          .from('question')
          .select('campaign_id');

        if (questionError) throw questionError;

        // Fetch answer counts per campaign
        const { data: answerCounts, error: answerError } = await supabase
          .from('answer')
          .select('survey_submission_id, survey_submissions!inner(campaign_id)');

        if (answerError) throw answerError;

        // Process the data
        const campaignsWithStats: CampaignWithStats[] = campaignsData.map(campaign => {
          const questionsForCampaign = questionCounts.filter(q => q.campaign_id === campaign.id).length;
          const answersForCampaign = answerCounts?.filter(
            (answer: { survey_submissions: { campaign_id: number } }) => 
              answer.survey_submissions && answer.survey_submissions.campaign_id === campaign.id
          ).length || 0;

          // Determine status based on dates
          const now = new Date();
          const startDate = campaign.start_date ? new Date(campaign.start_date) : null;
          const endDate = campaign.end_date ? new Date(campaign.end_date) : null;
          
          let status: "active" | "draft" | "completed" = "draft";
          if (startDate && endDate) {
            if (now >= startDate && now <= endDate) {
              status = "active";
            } else if (now > endDate) {
              status = "completed";
            }
          }

          return {
            id: campaign.id,
            name: campaign.name,
            description: campaign.description,
            campaign_uri: campaign.campaign_uri,
            start_date: campaign.start_date,
            end_date: campaign.end_date,
            status,
            questions: questionsForCampaign,
            answers: answersForCampaign
          };
        });

        setCampaigns(campaignsWithStats);
      } catch (error) {
        console.error('Error fetching campaigns:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCampaigns();
  }, [user]);

  const deleteCampaign = async (campaignId: number) => {
    try {
      const { error } = await supabase
        .from('campaign')
        .delete()
        .eq('id', campaignId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Campaign deleted successfully",
      });

      // Refresh campaigns
      setCampaigns(campaigns.filter(c => c.id !== campaignId));
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast({
        title: "Error",
        description: "Failed to delete campaign",
        variant: "destructive",
      });
    }
  };

  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const totalAnswers = campaigns.reduce((sum, c) => sum + c.answers, 0);

  if (loading) {
    return (
      <Layout currentPage="campaigns">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout currentPage="campaigns">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Campaign Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Manage your survey campaigns and track performance
            </p>
          </div>
          <Button 
            onClick={() => navigate('/campaigns/new')}
            className="bg-gradient-primary hover:opacity-90 transition-opacity"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Campaigns"
            value={totalCampaigns}
            icon={BarChart3}
          />
          <StatsCard
            title="Active Campaigns"
            value={activeCampaigns}
            icon={Play}
          />
          <StatsCard
            title="Total Answers"
            value={totalAnswers}
            icon={Users}
          />
        </div>

        {/* Campaigns Table */}
        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle>Campaigns</CardTitle>
            <CardDescription>
              Manage your survey campaigns and view their performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            {campaigns.length === 0 ? (
              <div className="text-center py-8">
                <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first campaign to start collecting survey responses
                </p>
                <Button
                  onClick={() => navigate('/campaigns/new')}
                  className="bg-gradient-primary hover:opacity-90"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Campaign
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {campaigns.map((campaign) => (
                  <Card key={campaign.id} className="border border-border">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-semibold">{campaign.name}</h3>
                            <Badge variant={
                              campaign.status === 'active' ? 'default' : 
                              campaign.status === 'completed' ? 'secondary' : 'outline'
                            }>
                              {campaign.status === 'active' && <Play className="h-3 w-3 mr-1" />}
                              {campaign.status === 'completed' && <Pause className="h-3 w-3 mr-1" />}
                              {campaign.status === 'draft' && <Calendar className="h-3 w-3 mr-1" />}
                              {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                            </Badge>
                          </div>
                          {campaign.description && (
                            <p className="text-muted-foreground mb-2">{campaign.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{campaign.questions} questions</span>
                            <span>{campaign.answers} answers</span>
                            {campaign.start_date && (
                              <span>Start: {new Date(campaign.start_date).toLocaleDateString()}</span>
                            )}
                            {campaign.end_date && (
                              <span>End: {new Date(campaign.end_date).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedCampaignForLinks(campaign)}
                          >
                            <Link className="h-4 w-4 mr-1" />
                            Generic Links
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedCampaignForInvitations(campaign)}
                          >
                            <Users className="h-4 w-4 mr-1" />
                            Personal Invitations
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/campaigns/edit/${campaign.id}`)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{campaign.name}"? This action cannot be undone and will delete all associated data including questions, answers, and invitations.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteCampaign(campaign.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete Campaign
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Campaign Links Modal */}
        {selectedCampaignForLinks && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-background rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">
                    Generic Links - {selectedCampaignForLinks.name}
                  </h2>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedCampaignForLinks(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
              <div className="p-6">
                <CampaignLinks
                  campaignId={selectedCampaignForLinks.id}
                  campaignUri={selectedCampaignForLinks.campaign_uri || ''}
                />
              </div>
            </div>
          </div>
        )}

        {/* Survey Invitations Modal */}
        {selectedCampaignForInvitations && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-background rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">
                    Personal Invitations - {selectedCampaignForInvitations.name}
                  </h2>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedCampaignForInvitations(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
              <div className="p-6">
                <SurveyInvitations
                  campaignId={selectedCampaignForInvitations.id}
                  campaignUri={selectedCampaignForInvitations.campaign_uri || ''}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}