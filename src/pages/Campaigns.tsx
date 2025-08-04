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
  Share2,
  Link
} from "lucide-react";
import { SurveyInvitations } from "@/components/SurveyInvitations";

interface CampaignWithStats {
  id: number;
  name: string;
  description: string | null;
  campaign_uri: string | null;
  start_date: string | null;
  end_date: string | null;
  status: "active" | "draft" | "completed";
  questions: number;
  calls: number;
  responses: number;
}

export default function Campaigns() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaignForInvitations, setSelectedCampaignForInvitations] = useState<CampaignWithStats | null>(null);

  useEffect(() => {
    const fetchCampaigns = async () => {
      console.log("fetchCampaigns called, user:", user);
      console.log("User ID:", user?.id);
      
      if (!user?.id) {
        console.log("No user ID available, skipping fetch");
        setLoading(false);
        return;
      }
      
      try {
        console.log("Starting campaigns fetch...");
        
        // Fetch campaigns with their related data
        const { data: campaignsData, error: campaignsError } = await supabase
          .from('campaign')
          .select('*')
          .eq('user_id', user?.id);

        console.log("Campaigns query result:", campaignsData);
        console.log("Campaigns query error:", campaignsError);
        if (campaignsError) throw campaignsError;

        // Fetch call counts per campaign
        const { data: callCounts, error: callError } = await supabase
          .from('survey_response')
          .select('campaign_id');

        if (callError) throw callError;

        // Fetch question counts per campaign
        const { data: questionCounts, error: questionError } = await supabase
          .from('question')
          .select('campaign_id');

        if (questionError) throw questionError;

        // Fetch answer counts per campaign (via calls)
        const { data: answerCounts, error: answerError } = await supabase
          .from('answer')
          .select('survey_response_id, survey_response!inner(campaign_id)');

        if (answerError) throw answerError;

        // Process the data
        const campaignsWithStats: CampaignWithStats[] = (campaignsData as any[]).map(campaign => {
          const callsForCampaign = callCounts.filter(call => call.campaign_id === campaign.id).length;
          const questionsForCampaign = questionCounts.filter(q => q.campaign_id === campaign.id).length;
          const responsesForCampaign = answerCounts.filter(
            answer => answer.survey_response && answer.survey_response.campaign_id === campaign.id
          ).length;

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
            calls: callsForCampaign,
            responses: responsesForCampaign
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

  const handleDeleteCampaign = async (campaignId: number, campaignName: string) => {
    try {
      // Delete related data first (foreign key constraints)
      await supabase
        .from('campaign_room_mapping')
        .delete()
        .eq('campaign_id', campaignId);

      await supabase
        .from('answer')
        .delete()
        .in('survey_response_id', 
          (await supabase
            .from('survey_response')
            .select('id')
            .eq('campaign_id', campaignId)
          ).data?.map(sr => sr.id) || []
        );

      await supabase
        .from('survey_response')
        .delete()
        .eq('campaign_id', campaignId);

      await supabase
        .from('question')
        .delete()
        .eq('campaign_id', campaignId);

      // Finally delete the campaign
      const { error } = await supabase
        .from('campaign')
        .delete()
        .eq('id', campaignId);

      if (error) throw error;

      // Update local state
      setCampaigns(prev => prev.filter(c => c.id !== campaignId));
      
      toast({
        title: "Campaign deleted",
        description: `"${campaignName}" has been successfully deleted.`,
      });
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast({
        title: "Error",
        description: "Failed to delete campaign. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleShareCampaign = async (campaign: CampaignWithStats) => {
    if (!campaign.campaign_uri) {
      toast({
        title: "No survey URL",
        description: "This campaign doesn't have a URI configured.",
        variant: "destructive",
      });
      return;
    }

    const surveyUrl = `https://survey.generative-ai.ca/${campaign.campaign_uri}`;
    
    try {
      await navigator.clipboard.writeText(surveyUrl);
      toast({
        title: "Survey URL copied!",
        description: "The survey link has been copied to your clipboard.",
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please copy the URL manually: " + surveyUrl,
        variant: "destructive",
      });
    }
  };

  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter(c => c.status === "active").length;
  const totalCalls = campaigns.reduce((sum, c) => sum + c.calls, 0);
  const totalResponses = campaigns.reduce((sum, c) => sum + c.responses, 0);

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
            title="Total Calls"
            value={totalCalls}
            icon={Phone}
          />
          <StatsCard
            title="Total Responses"
            value={totalResponses}
            icon={Users}
          />
        </div>

        {/* Campaigns Table */}
        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle>All Campaigns</CardTitle>
            <CardDescription>
              Overview of all survey campaigns and their current status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">Loading campaigns...</div>
              </div>
            ) : campaigns.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">No campaigns found</div>
              </div>
            ) : (
              <div className="space-y-4">
                {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between p-6 rounded-lg border bg-card hover:shadow-sm transition-shadow"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">{campaign.name}</h3>
                      <Badge 
                        variant={campaign.status === "active" ? "default" : "secondary"}
                        className={campaign.status === "active" ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
                      >
                        {campaign.status}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">{campaign.description}</p>
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {campaign.start_date} - {campaign.end_date}
                      </div>
                      <div className="flex items-center gap-4">
                        <span>{campaign.questions} questions</span>
                        <span>{campaign.calls} calls</span>
                        <span>{campaign.responses} responses</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="hover:bg-accent"
                      onClick={() => setSelectedCampaignForInvitations(campaign)}
                      disabled={!campaign.campaign_uri}
                    >
                      <Link className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="hover:bg-accent"
                      onClick={() => handleShareCampaign(campaign)}
                      disabled={!campaign.campaign_uri}
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="hover:bg-accent"
                      onClick={() => navigate(`/campaigns/edit/${campaign.id}`)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className={campaign.status === "active" ? "hover:bg-yellow-50" : "hover:bg-green-50"}
                    >
                      {campaign.status === "active" ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{campaign.name}"? This action cannot be undone and will permanently delete the campaign along with all associated questions, calls, and responses.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteCampaign(campaign.id, campaign.name)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Survey Invitations Modal/Section */}
        {selectedCampaignForInvitations && (
          <Card className="bg-gradient-card shadow-card border-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Survey Invitations - {selectedCampaignForInvitations.name}</CardTitle>
                  <CardDescription>
                    Create unique survey links with QR codes for specific users
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setSelectedCampaignForInvitations(null)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <SurveyInvitations
                campaignId={selectedCampaignForInvitations.id}
                campaignUri={selectedCampaignForInvitations.campaign_uri || ''}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}