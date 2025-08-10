import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Users, Mail, CheckCircle, Clock, MapPin, Briefcase, Phone, Link, BarChart3 } from "lucide-react";
import { format } from "date-fns";

interface CampaignOption {
  id: number;
  name: string;
}

interface UserProfile {
  id: string;
  campaign_id: number;
  full_name: string | null;
  email: string | null;
  geography: string | null;
  occupation: string | null;
  phone_number: string | null;
  link_token: string;
  link_type: string;
  invitation_token: string | null;
  created_at: string;
  updated_at: string;
}

interface SurveyInvitation {
  id: string;
  invitation_type: 'email' | 'phone' | 'other';
  contact_value: string;
  sent_at: string | null;
  responded_at: string | null;
  user_id: string | null;
  unique_token: string;
}

interface CampaignLink {
  id: string;
  name: string | null;
  description: string | null;
  unique_token: string;
  is_active: boolean;
  max_responses: number | null;
  current_responses: number;
  created_at: string;
}

interface SurveySubmission {
  id: string;
  campaign_id: number;
  user_profile_id: string | null;
  room_name: string | null;
  link_token: string;
  link_type: 'generic' | 'personal';
  s3_recording_url: string | null;
  created_at: string;
  updated_at: string;
  call_timestamp: string | null;
  user_profile?: UserProfile;
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
  email: string | null;
  fullName: string | null;
  geography: string | null;
  occupation: string | null;
  sentAt: string | null;
  respondedAt: string | null;
  phoneNumber: string | null;
  roomName: string | null;
  linkType: 'generic' | 'personal';
  linkName?: string;
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
  totalGenericLinks: number;
  totalGenericResponses: number;
  genericResponseRate: number;
  respondents: Respondent[];
}

export default function Analytics() {
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [analytics, setAnalytics] = useState<ResponseAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchCampaigns();
  }, [user?.id]);

  useEffect(() => {
    if (selectedCampaign) {
      fetchAnalytics(selectedCampaign);
    }
  }, [selectedCampaign]);

  const fetchCampaigns = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('campaign')
        .select('id, name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
      
      // Automatically select the first campaign if available and no campaign is currently selected
      if (data && data.length > 0 && !selectedCampaign) {
        setSelectedCampaign(data[0].id.toString());
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      toast({
        title: 'Error',
        description: 'Failed to load campaigns',
        variant: 'destructive',
      });
    }
  };

  const fetchAnalytics = async (campaignId: string) => {
    if (!campaignId) return;
    
    setLoading(true);
    try {
      const campaignIdNum = parseInt(campaignId);

      // Fetch all invitations for the campaign
      const { data: invitations, error: invitationsError } = await supabase
        .from('survey_invitations')
        .select('id, invitation_type, contact_value, sent_at, responded_at, user_id, unique_token')
        .eq('campaign_id', campaignIdNum)
        .order('created_at', { ascending: false });

      if (invitationsError) throw invitationsError;

      // Fetch all generic links for the campaign
      const { data: genericLinks, error: genericLinksError } = await supabase
        .from('campaign_links')
        .select('id, name, description, unique_token, is_active, max_responses, current_responses, created_at')
        .eq('campaign_id', campaignIdNum)
        .eq('link_type', 'generic')
        .order('created_at', { ascending: false });

      if (genericLinksError) throw genericLinksError;

      // Fetch submissions with user profiles
      const { data: submissions, error: submissionsError } = await supabase
        .from('survey_submissions')
        .select(`
          id,
          campaign_id,
          user_profile_id,
          room_name,
          link_token,
          link_type,
          s3_recording_url,
          created_at,
          updated_at,
          call_timestamp,
          user_profile:user_profiles (
            id,
            campaign_id,
            full_name,
            email,
            geography,
            occupation,
            phone_number,
            link_token,
            link_type,
            invitation_token,
            created_at,
            updated_at
          ),
          answer (
            answer_text,
            question (
              question_text,
              question_order
            )
          )
        `)
        .eq('campaign_id', campaignIdNum)
        .order('created_at', { ascending: false });

      if (submissionsError) throw submissionsError;

      console.log('Debug - Invitations:', invitations?.length);
      console.log('Debug - Generic Links:', genericLinks?.length);
      console.log('Debug - Submissions:', submissions?.length);

      // Process analytics
      const totalInvitations = invitations?.length || 0;
      const totalResponses = submissions?.length || 0;
      const responseRate = totalInvitations > 0 ? (totalResponses / totalInvitations) * 100 : 0;

      const totalGenericLinks = genericLinks?.length || 0;
      const totalGenericResponses = genericLinks?.reduce((sum, link) => sum + link.current_responses, 0) || 0;
      const genericResponseRate = totalGenericLinks > 0 ? (totalGenericResponses / totalGenericLinks) * 100 : 0;

      // Process respondents
      const respondents: Respondent[] = (submissions || []).map(submission => {
        // Find the corresponding invitation or generic link
        let invitation = null;
        let genericLink = null;

        if (submission.link_type === 'personal') {
          invitation = invitations?.find(inv => inv.unique_token === submission.link_token);
        } else {
          genericLink = genericLinks?.find(link => link.unique_token === submission.link_token);
        }

        // Get user information from user_profile
        const userProfile = submission.user_profile;

        return {
          id: submission.id,
          email: userProfile?.email || null,
          fullName: userProfile?.full_name || null,
          geography: userProfile?.geography || null,
          occupation: userProfile?.occupation || null,
          sentAt: invitation?.sent_at || null,
          respondedAt: submission.created_at,
          phoneNumber: userProfile?.phone_number || null,
          roomName: submission.room_name,
          linkType: submission.link_type as 'generic' | 'personal',
          linkName: genericLink?.name || undefined,
          answers: (submission.answer || []).map(ans => ({
            questionText: ans.question.question_text,
            answerText: ans.answer_text,
            questionOrder: ans.question.question_order
          }))
        };
      });

      setAnalytics({
        totalInvitations,
        totalResponses,
        responseRate,
        totalGenericLinks,
        totalGenericResponses,
        genericResponseRate,
        respondents
      });

    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: 'Error',
        description: 'Failed to load analytics',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (respondedAt: string | null) => {
    if (respondedAt) {
      return <Badge className="bg-green-100 text-green-800 border-green-200">Completed</Badge>;
    }
    return <Badge variant="outline" className="border-orange-200 text-orange-700">Pending</Badge>;
  };

  const getLinkTypeBadge = (linkType: 'generic' | 'personal') => {
    return (
      <Badge variant={linkType === 'generic' ? 'default' : 'secondary'}>
        {linkType === 'generic' ? <Link className="h-3 w-3 mr-1" /> : <Users className="h-3 w-3 mr-1" />}
        {linkType.charAt(0).toUpperCase() + linkType.slice(1)}
      </Badge>
    );
  };

  return (
    <Layout currentPage="analytics">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Track and analyze your survey campaign performance
          </p>
        </div>

        {/* Campaign Selector */}
        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle>Select Campaign</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger className="w-full max-w-md">
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

        {/* Analytics Overview */}
        {analytics && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-gradient-card shadow-card border-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Invitations</CardTitle>
                <Mail className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.totalInvitations}</div>
                <p className="text-xs text-muted-foreground">
                  Personal invitations sent
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card shadow-card border-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.totalResponses}</div>
                <p className="text-xs text-muted-foreground">
                  {analytics.responseRate.toFixed(1)}% response rate
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card shadow-card border-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Generic Links</CardTitle>
                <Link className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.totalGenericLinks}</div>
                <p className="text-xs text-muted-foreground">
                  Shared links created
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card shadow-card border-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Generic Responses</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.totalGenericResponses}</div>
                <p className="text-xs text-muted-foreground">
                  {analytics.genericResponseRate.toFixed(1)}% response rate
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Detailed Analytics */}
        {analytics && (
          <Tabs defaultValue="respondents" className="space-y-4">
            <TabsList>
              <TabsTrigger value="respondents">Respondents</TabsTrigger>
              <TabsTrigger value="responses">Response Details</TabsTrigger>
            </TabsList>

            <TabsContent value="respondents" className="space-y-4">
              <Card className="bg-gradient-card shadow-card border-0">
                <CardHeader>
                  <CardTitle>Respondents</CardTitle>
                  <CardDescription>
                    Detailed view of all survey respondents
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics.respondents.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No responses yet</h3>
                      <p className="text-muted-foreground">
                        Responses will appear here once people start taking your survey
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead>Link Type</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Occupation</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analytics.respondents.map((respondent) => (
                          <TableRow key={respondent.id}>
                            <TableCell>
                              <div className="font-medium">
                                {respondent.fullName || 'Anonymous'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {respondent.email && <Mail className="h-3 w-3" />}
                                {respondent.phoneNumber && <Phone className="h-3 w-3" />}
                                <span>
                                  {respondent.email || respondent.phoneNumber || 'N/A'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {getLinkTypeBadge(respondent.linkType)}
                              {respondent.linkName && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {respondent.linkName}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {respondent.geography ? (
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {respondent.geography}
                                </div>
                              ) : (
                                'N/A'
                              )}
                            </TableCell>
                            <TableCell>
                              {respondent.occupation ? (
                                <div className="flex items-center gap-1">
                                  <Briefcase className="h-3 w-3" />
                                  {respondent.occupation}
                                </div>
                              ) : (
                                'N/A'
                              )}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(respondent.respondedAt)}
                            </TableCell>
                            <TableCell>
                              {respondent.respondedAt ? (
                                format(new Date(respondent.respondedAt), 'MMM dd, yyyy')
                              ) : (
                                'N/A'
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="responses" className="space-y-4">
              <Card className="bg-gradient-card shadow-card border-0">
                <CardHeader>
                  <CardTitle>Response Details</CardTitle>
                  <CardDescription>
                    Detailed responses from survey participants
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics.respondents.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No responses yet</h3>
                      <p className="text-muted-foreground">
                        Response details will appear here once people start taking your survey
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {analytics.respondents.map((respondent) => (
                        <Card key={respondent.id} className="border border-border">
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-lg">
                                  {respondent.fullName || 'Anonymous Respondent'}
                                </CardTitle>
                                <CardDescription>
                                  {respondent.email || respondent.phoneNumber || 'No contact info'} • {format(new Date(respondent.respondedAt!), 'MMM dd, yyyy HH:mm')}
                                </CardDescription>
                              </div>
                              {getLinkTypeBadge(respondent.linkType)}
                            </div>
                          </CardHeader>
                          <CardContent>
                            {respondent.answers.length === 0 ? (
                              <p className="text-muted-foreground">No answers recorded</p>
                            ) : (
                              <div className="space-y-4">
                                {respondent.answers
                                  .sort((a, b) => a.questionOrder - b.questionOrder)
                                  .map((answer, index) => (
                                    <div key={index} className="border-l-2 border-primary pl-4">
                                      <h4 className="font-medium mb-1">{answer.questionText}</h4>
                                      <p className="text-muted-foreground">{answer.answerText}</p>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2 text-muted-foreground">Loading analytics...</span>
          </div>
        )}
      </div>
    </Layout>
  );
}