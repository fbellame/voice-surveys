import { useState } from "react";
import { Layout } from "@/components/Layout";
import { StatsCard } from "@/components/StatsCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

// Mock data - will be replaced with Supabase data
const mockCampaigns = [
  {
    id: 1,
    name: "InnoVet-AMR 2024",
    description: "Survey on climate change, AMR, and animal health.",
    status: "active",
    start_date: "2024-01-15",
    end_date: "2024-12-31",
    questions: 3,
    calls: 3,
    responses: 9
  },
  {
    id: 2,
    name: "Customer Satisfaction Q4",
    description: "Quarterly customer satisfaction survey.",
    status: "draft",
    start_date: "2024-10-01",
    end_date: "2024-11-30",
    questions: 5,
    calls: 0,
    responses: 0
  }
];

export default function Campaigns() {
  const [campaigns] = useState(mockCampaigns);

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
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}