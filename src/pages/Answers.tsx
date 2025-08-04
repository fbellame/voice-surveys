import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Download, Filter, Search, Play, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface SurveyResponse {
  id: number;
  phone_number: string;
  room_name: string;
  call_timestamp: string;
  s3_recording_url?: string;
  campaign: {
    id: number;
    name: string;
    campaign_type: string;
  };
  answers: Answer[];
}

interface Answer {
  id: number;
  answer_text: string;
  answered_at: string;
  question_id: number;
  question: {
    question_text: string;
    question_order: number;
  };
}

interface Campaign {
  id: number;
  name: string;
  campaign_type: string;
}

export default function Answers() {
  const { toast } = useToast();
  const [surveyResponses, setSurveyResponses] = useState<SurveyResponse[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchData();
  }, [selectedCampaign, timeFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch campaigns
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaign')
        .select('id, name, campaign_type')
        .order('created_at', { ascending: false });

      if (campaignsError) throw campaignsError;
      setCampaigns(campaignsData || []);

      // Fetch survey responses first
      let responsesQuery = supabase
        .from('survey_response')
        .select(`
          id,
          phone_number,
          room_name,
          call_timestamp,
          s3_recording_url,
          campaign_id
        `)
        .order('call_timestamp', { ascending: false });

      // Apply campaign filter
      if (selectedCampaign !== "all") {
        responsesQuery = responsesQuery.eq('campaign_id', parseInt(selectedCampaign));
      }

      // Apply time filter
      if (timeFilter !== "all") {
        const now = new Date();
        let dateLimit: Date;
        
        switch (timeFilter) {
          case "today":
            dateLimit = new Date(now.setHours(0, 0, 0, 0));
            break;
          case "week":
            dateLimit = new Date(now.setDate(now.getDate() - 7));
            break;
          case "month":
            dateLimit = new Date(now.setMonth(now.getMonth() - 1));
            break;
          default:
            dateLimit = new Date(0);
        }
        
        responsesQuery = responsesQuery.gte('call_timestamp', dateLimit.toISOString());
      }

      const { data: responsesData, error: responsesError } = await responsesQuery;
      
      if (responsesError) throw responsesError;

      // Fetch all answers with questions for these responses
      const responseIds = responsesData?.map(r => r.id) || [];
      
      let answersData: any[] = [];
      if (responseIds.length > 0) {
        const { data: fetchedAnswers, error: answersError } = await supabase
          .from('answer')
          .select(`
            id,
            answer_text,
            answered_at,
            question_id,
            survey_response_id,
            question:question_id (
              question_text,
              question_order
            )
          `)
          .in('survey_response_id', responseIds);

        if (answersError) throw answersError;
        answersData = fetchedAnswers || [];
      }

      // Transform data to match our interface
      const transformedData: SurveyResponse[] = responsesData?.map(response => {
        const campaign = campaignsData?.find(c => c.id === response.campaign_id);
        const responseAnswers = answersData
          .filter(a => a.survey_response_id === response.id)
          .sort((a, b) => a.question.question_order - b.question.question_order);

        return {
          id: response.id,
          phone_number: response.phone_number,
          room_name: response.room_name,
          call_timestamp: response.call_timestamp,
          s3_recording_url: response.s3_recording_url,
          campaign: {
            id: campaign?.id || response.campaign_id,
            name: campaign?.name || 'Unknown Campaign',
            campaign_type: campaign?.campaign_type || 'unknown'
          },
          answers: responseAnswers
        };
      }) || [];

      setSurveyResponses(transformedData);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Error loading data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredResponses = surveyResponses.filter(response => {
    if (!searchQuery) return true;
    
    const searchLower = searchQuery.toLowerCase();
    return (
      response.campaign.name.toLowerCase().includes(searchLower) ||
      response.phone_number.includes(searchQuery) ||
      response.room_name.toLowerCase().includes(searchLower) ||
      response.answers.some(answer => 
        answer.answer_text.toLowerCase().includes(searchLower) ||
        answer.question.question_text.toLowerCase().includes(searchLower)
      )
    );
  });

  const toggleExpanded = (responseId: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(responseId)) {
      newExpanded.delete(responseId);
    } else {
      newExpanded.add(responseId);
    }
    setExpandedRows(newExpanded);
  };

  const openRecording = async (s3Url: string) => {
    try {
      // Call the edge function to get a signed URL
      const { data, error } = await supabase.functions.invoke('s3-signed-url', {
        body: { s3Url }
      });

      if (error) {
        console.error('Error getting signed URL:', error);
        toast({
          title: "Error",
          description: "Failed to access recording",
          variant: "destructive",
        });
        return;
      }

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      } else {
        toast({
          title: "Error",
          description: "Invalid response from server",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error opening recording:', error);
      toast({
        title: "Error",
        description: "Failed to open recording",
        variant: "destructive",
      });
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Response ID',
      'Campaign',
      'Type',
      'Date',
      'Phone',
      'Room',
      'Question',
      'Answer',
      'Question Order'
    ];

    const csvData: string[][] = [];
    filteredResponses.forEach(response => {
      if (response.answers.length === 0) {
        csvData.push([
          response.id.toString(),
          response.campaign.name,
            response.campaign.campaign_type === 'web_survey' ? 'Web Survey' : 'Phone Survey',
          format(new Date(response.call_timestamp), 'dd/MM/yyyy HH:mm'),
          response.phone_number,
          response.room_name,
          '-',
          '-',
          '-'
        ]);
      } else {
        response.answers.forEach(answer => {
          csvData.push([
            response.id.toString(),
            response.campaign.name,
            response.campaign.campaign_type === 'web_survey' ? 'Web Survey' : 'Phone Survey',
            format(new Date(response.call_timestamp), 'dd/MM/yyyy HH:mm'),
            response.phone_number,
            response.room_name,
            answer.question.question_text,
            answer.answer_text,
            answer.question.question_order.toString()
          ]);
        });
      }
    });

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `survey_responses_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const exportToJSON = () => {
    const jsonData = filteredResponses.map(response => ({
      response_id: response.id,
      campaign: response.campaign.name,
      campaign_type: response.campaign.campaign_type,
      timestamp: response.call_timestamp,
      phone_number: response.phone_number,
      room_name: response.room_name,
      s3_recording_url: response.s3_recording_url,
      answers: response.answers.map(answer => ({
        question: answer.question.question_text,
        answer: answer.answer_text,
        question_order: answer.question.question_order,
        answered_at: answer.answered_at
      }))
    }));

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `survey_responses_${format(new Date(), 'yyyy-MM-dd')}.json`;
    link.click();
  };

  return (
    <Layout currentPage="answers">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Survey Responses</h1>
          <p className="text-muted-foreground mt-2">
            Manage and analyze survey responses
          </p>
        </div>

        {/* Filters */}
        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters and Export
            </CardTitle>
            <CardDescription>
              Filter responses and export data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2">
                <label className="text-sm font-medium">Campaign</label>
                <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All campaigns" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All campaigns</SelectItem>
                    {campaigns.map(campaign => (
                      <SelectItem key={campaign.id} value={campaign.id.toString()}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Period</label>
                <Select value={timeFilter} onValueChange={setTimeFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">Last 7 days</SelectItem>
                    <SelectItem value="month">Last 30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 flex-1 min-w-64">
                <label className="text-sm font-medium">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search in responses..."
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={exportToCSV}
                  variant="outline"
                  className="hover:bg-accent"
                  disabled={filteredResponses.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </Button>
                <Button
                  onClick={exportToJSON}
                  variant="outline"
                  className="hover:bg-accent"
                  disabled={filteredResponses.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  JSON
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle>
              Survey Responses ({filteredResponses.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading responses...
              </div>
            ) : filteredResponses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No responses found
              </div>
            ) : (
              <div className="space-y-4">
                {filteredResponses.map((response) => (
                  <Card key={response.id} className="border">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpanded(response.id)}
                            className="p-1"
                          >
                            {expandedRows.has(response.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{response.campaign.name}</h3>
                              <Badge variant={response.campaign.campaign_type === 'web_survey' ? 'default' : 'secondary'}>
                                {response.campaign.campaign_type === 'web_survey' ? 'Web' : 'Phone'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(response.call_timestamp), 'dd/MM/yyyy HH:mm')} • 
                              {response.campaign.campaign_type === 'phone_survey' ? ` ${response.phone_number}` : ` ${response.room_name}`}
                            </p>
                          </div>
                        </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              {response.answers.length} answer{response.answers.length > 1 ? 's' : ''}
                            </span>
                            {response.s3_recording_url && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openRecording(response.s3_recording_url!)}
                                className="flex items-center gap-1"
                              >
                                <Play className="h-3 w-3" />
                                Recording
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                      </div>

                      {expandedRows.has(response.id) && response.answers.length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="space-y-3">
                            {response.answers.map((answer) => (
                              <div key={answer.id} className="bg-muted/50 rounded-lg p-3">
                                <div className="flex justify-between items-start mb-2">
                                  <p className="font-medium text-sm">{answer.question.question_text}</p>
                                  <span className="text-xs text-muted-foreground ml-2">
                                    #{answer.question.question_order}
                                  </span>
                                </div>
                                <p className="text-sm">{answer.answer_text}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {format(new Date(answer.answered_at), 'dd/MM/yyyy HH:mm')}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}