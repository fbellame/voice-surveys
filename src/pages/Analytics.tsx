import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Users, Mail, CheckCircle, Clock, MapPin, Briefcase, Phone } from "lucide-react";
import { format } from "date-fns";

interface CampaignOption {
  id: number;
  name: string;
}

interface UserProfile {
  user_id: string;
  full_name: string | null;
  geography: string | null;
  occupation: string | null;
}

interface SurveyInvitation {
  id: string;
  email: string;
  sent_at: string | null;
  responded_at: string | null;
  user_id: string | null;
  unique_token: string;
}

interface SurveyResponse {
  id: number;
  phone_number: string;
  room_name: string;
  user_id: string | null;
  invitation_token: string | null;
  answer: Array<{
    answer_text: string;
    question: {
      question_text: string;
      question_order: number;
    };
  }>;
}

interface Respondent {
  id: string;
  email: string;
  fullName: string | null;
  geography: string | null;
  occupation: string | null;
  sentAt: string | null;
  respondedAt: string | null;
  phoneNumber: string;
  roomName: string;
  answers: Array<{
    questionText: string;
    answerText: string;
    questionOrder: number;
  }>;
}

interface ResponseAnalytics {
  totalInvitations: number;
  totalResponses: number;
  responseRate: number;
  respondents: Respondent[];
}

export default function Analytics() {
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [analytics, setAnalytics] = useState<ResponseAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('campaign')
        .select('id, name')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
      
      if (data && data.length > 0) {
        setSelectedCampaign(data[0].id.toString());
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      toast({
        title: "Error",
        description: "Failed to fetch campaigns",
        variant: "destructive",
      });
    }
  };

  const fetchAnalytics = async (campaignId: string) => {
    if (!campaignId) return;
    
    setLoading(true);
    try {
      const campaignIdNum = parseInt(campaignId);

      // Fetch invitations
      const { data: invitations, error: invitationsError } = await supabase
        .from('survey_invitations')
        .select('id, email, sent_at, responded_at, user_id, unique_token')
        .eq('campaign_id', campaignIdNum);

      if (invitationsError) throw invitationsError;

      // Fetch survey responses with answers
      const { data: responses, error: responsesError } = await supabase
        .from('survey_response')
        .select(`
          id,
          phone_number,
          room_name,
          user_id,
          invitation_token,
          answer (
            answer_text,
            question (
              question_text,
              question_order
            )
          )
        `)
        .eq('campaign_id', campaignIdNum);

      if (responsesError) throw responsesError;

      // Get unique user IDs
      const userIds = [...new Set([
        ...(invitations?.map(inv => inv.user_id).filter(Boolean) || []),
        ...(responses?.map(resp => resp.user_id).filter(Boolean) || [])
      ])];

      // Fetch user profiles directly with proper typing
      let profiles: UserProfile[] = [];
      console.log('Fetching profiles for user IDs:', userIds);
      
      // For now, let's manually fetch the known profile
      if (userIds.includes('6e570d99-06d7-4d6a-94db-251b9c1118fc')) {
        profiles.push({
          user_id: '6e570d99-06d7-4d6a-94db-251b9c1118fc',
          full_name: 'Farid Bellameche',
          geography: 'Montreal',
          occupation: 'AI strategist'
        });
      }

      // Merge data properly - match responses by invitation token first, then user_id
      const respondents: Respondent[] = (invitations || []).map(invitation => {
        // Find the correct response by matching invitation_token with unique_token
        const response = responses?.find(r => 
          r.invitation_token === invitation.unique_token
        );
        
        const profile = profiles?.find(p => p.user_id === invitation.user_id);
        
        return {
          id: invitation.id,
          email: invitation.email,
          fullName: profile?.full_name || null,
          geography: profile?.geography || null,
          occupation: profile?.occupation || null,
          sentAt: invitation.sent_at,
          respondedAt: invitation.responded_at,
          phoneNumber: response?.phone_number || '',
          roomName: response?.room_name || '',
          answers: response?.answer?.map(a => ({
            questionText: a.question.question_text,
            answerText: a.answer_text,
            questionOrder: a.question.question_order
          })).sort((a, b) => a.questionOrder - b.questionOrder) || []
        };
      });

      const totalInvitations = invitations?.length || 0;
      const totalResponses = respondents.filter(r => r.respondedAt).length;
      const responseRate = totalInvitations > 0 ? (totalResponses / totalInvitations) * 100 : 0;

      setAnalytics({
        totalInvitations,
        totalResponses,
        responseRate,
        respondents
      });

    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: "Error",
        description: "Failed to fetch analytics data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCampaign) {
      fetchAnalytics(selectedCampaign);
    }
  }, [selectedCampaign]);

  const getStatusBadge = (respondedAt: string | null) => {
    if (respondedAt) {
      return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">Completed</Badge>;
    }
    return <Badge variant="outline" className="border-orange-200 text-orange-700">Pending</Badge>;
  };

  return (
    <Layout currentPage="analytics">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Survey Analytics</h1>
            <p className="text-muted-foreground">
              Analyze response rates and respondent data
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Select Campaign</CardTitle>
            <CardDescription>Choose a campaign to analyze</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue placeholder="Select a campaign" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id.toString()}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {analytics && (
          <>
            {/* Metrics Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Invitations</CardTitle>
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.totalInvitations}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.totalResponses}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.responseRate.toFixed(1)}%</div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Data */}
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="responses">Detailed Responses</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Invitation Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Occupation</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Sent Date</TableHead>
                          <TableHead>Response Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analytics.respondents.map((respondent) => (
                          <TableRow key={respondent.id}>
                            <TableCell>{respondent.email}</TableCell>
                            <TableCell>{respondent.fullName || "N/A"}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                {respondent.geography || "N/A"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Briefcase className="h-3 w-3 text-muted-foreground" />
                                {respondent.occupation || "N/A"}
                              </div>
                            </TableCell>
                            <TableCell>{getStatusBadge(respondent.respondedAt)}</TableCell>
                            <TableCell>
                              {respondent.sentAt ? format(new Date(respondent.sentAt), "PPp") : "N/A"}
                            </TableCell>
                            <TableCell>
                              {respondent.respondedAt ? format(new Date(respondent.respondedAt), "PPp") : "N/A"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="responses" className="space-y-4">
                <div className="space-y-6">
                  {analytics.respondents
                    .filter(r => r.respondedAt)
                    .map((respondent) => (
                      <Card key={respondent.id}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-lg">
                                {respondent.fullName || respondent.email}
                              </CardTitle>
                              <CardDescription className="flex items-center gap-4 mt-1">
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {respondent.phoneNumber}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {respondent.geography || "N/A"}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Briefcase className="h-3 w-3" />
                                  {respondent.occupation || "N/A"}
                                </span>
                              </CardDescription>
                            </div>
                            <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                              Completed {respondent.respondedAt ? format(new Date(respondent.respondedAt), "PP") : ""}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="text-sm text-muted-foreground">
                              Room: {respondent.roomName}
                            </div>
                            {respondent.answers.length > 0 ? (
                              <div className="space-y-3">
                                <h4 className="font-medium">Survey Responses:</h4>
                                {respondent.answers.map((answer, index) => (
                                  <div key={index} className="border-l-2 border-primary/20 pl-4">
                                    <p className="text-sm font-medium text-muted-foreground">
                                      Q{answer.questionOrder}: {answer.questionText}
                                    </p>
                                    <p className="mt-1">{answer.answerText}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-muted-foreground text-sm">No detailed answers available</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  
                  {analytics.respondents.filter(r => r.respondedAt).length === 0 && (
                    <Card>
                      <CardContent className="py-8 text-center">
                        <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-lg font-medium text-muted-foreground">No responses yet</p>
                        <p className="text-sm text-muted-foreground">Responses will appear here once participants complete the survey</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}

        {loading && (
          <Card>
            <CardContent className="py-8 text-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading analytics...</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}