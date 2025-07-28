import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { StatsCard } from "@/components/StatsCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Calendar
} from "lucide-react";

interface CampaignWithStats {
  id: number;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: "active" | "draft" | "completed";
  questions: number;
  calls: number;
  responses: number;
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<CampaignWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        // Fetch campaigns with their related data
        const { data: campaignsData, error: campaignsError } = await supabase
          .from('campaign')
          .select('*');

        if (campaignsError) throw campaignsError;

        // Fetch call counts per campaign
        const { data: callCounts, error: callError } = await supabase
          .from('call')
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
          .select('call_id, call!inner(campaign_id)');

        if (answerError) throw answerError;

        // Process the data
        const campaignsWithStats: CampaignWithStats[] = campaignsData.map(campaign => {
          const callsForCampaign = callCounts.filter(call => call.campaign_id === campaign.id).length;
          const questionsForCampaign = questionCounts.filter(q => q.campaign_id === campaign.id).length;
          const responsesForCampaign = answerCounts.filter(
            answer => answer.call && answer.call.campaign_id === campaign.id
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
  }, []);

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
          <Button className="bg-gradient-primary hover:opacity-90 transition-opacity">
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
            trend={{ value: 12, isPositive: true }}
          />
          <StatsCard
            title="Active Campaigns"
            value={activeCampaigns}
            icon={Play}
            trend={{ value: 8, isPositive: true }}
          />
          <StatsCard
            title="Total Calls"
            value={totalCalls}
            icon={Phone}
            trend={{ value: 23, isPositive: true }}
          />
          <StatsCard
            title="Total Responses"
            value={totalResponses}
            icon={Users}
            trend={{ value: 31, isPositive: true }}
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}