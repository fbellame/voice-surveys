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
import { Download, Filter, Search } from "lucide-react";
import { format } from "date-fns";

interface Answer {
  id: number;
  answer_text: string;
  answered_at: string;
  question_id: number;
  call_id?: number;
  question: {
    question_text: string;
    question_order: number;
    campaign: {
      id: number;
      name: string;
      campaign_type: string;
    };
  };
  call?: {
    phone_number?: string;
    room_name?: string;
  };
}

interface Campaign {
  id: number;
  name: string;
  campaign_type: string;
}

export default function Answers() {
  const { toast } = useToast();
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

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

      // Build query for answers with filters
      let query = supabase
        .from('answer')
        .select(`
          id,
          answer_text,
          answered_at,
          question_id,
          call_id,
          question:question_id (
            question_text,
            question_order,
            campaign:campaign_id (
              id,
              name,
              campaign_type
            )
          ),
          call:call_id (
            phone_number,
            room_name
          )
        `)
        .order('answered_at', { ascending: false });

      // Apply campaign filter
      if (selectedCampaign !== "all") {
        const campaignAnswers = await supabase
          .from('question')
          .select('id')
          .eq('campaign_id', parseInt(selectedCampaign));
        
        if (campaignAnswers.data) {
          const questionIds = campaignAnswers.data.map(q => q.id);
          query = query.in('question_id', questionIds);
        }
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
        
        query = query.gte('answered_at', dateLimit.toISOString());
      }

      const { data: answersData, error: answersError } = await query;
      
      if (answersError) throw answersError;
      setAnswers(answersData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors du chargement des données",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredAnswers = answers.filter(answer => {
    if (!searchQuery) return true;
    
    const searchLower = searchQuery.toLowerCase();
    return (
      answer.answer_text.toLowerCase().includes(searchLower) ||
      answer.question.question_text.toLowerCase().includes(searchLower) ||
      answer.question.campaign.name.toLowerCase().includes(searchLower) ||
      (answer.call?.phone_number && answer.call.phone_number.includes(searchQuery))
    );
  });

  const exportToCSV = () => {
    const headers = [
      'Campagne',
      'Type',
      'Question',
      'Réponse',
      'Date',
      'Téléphone',
      'Salle'
    ];

    const csvData = filteredAnswers.map(answer => [
      answer.question.campaign.name,
      answer.question.campaign.campaign_type === 'web_survey' ? 'Sondage Web' : 'Sondage Téléphonique',
      answer.question.question_text,
      answer.answer_text,
      format(new Date(answer.answered_at), 'dd/MM/yyyy HH:mm'),
      answer.call?.phone_number || '-',
      answer.call?.room_name || '-'
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `answers_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const exportToJSON = () => {
    const jsonData = filteredAnswers.map(answer => ({
      campaign: answer.question.campaign.name,
      campaign_type: answer.question.campaign.campaign_type,
      question: answer.question.question_text,
      question_order: answer.question.question_order,
      answer: answer.answer_text,
      answered_at: answer.answered_at,
      phone_number: answer.call?.phone_number,
      room_name: answer.call?.room_name
    }));

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `answers_${format(new Date(), 'yyyy-MM-dd')}.json`;
    link.click();
  };

  return (
    <Layout currentPage="answers">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Réponses</h1>
          <p className="text-muted-foreground mt-2">
            Gérer et analyser les réponses aux sondages
          </p>
        </div>

        {/* Filters */}
        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtres et Export
            </CardTitle>
            <CardDescription>
              Filtrer les réponses et exporter les données
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2">
                <label className="text-sm font-medium">Campagne</label>
                <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Toutes les campagnes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les campagnes</SelectItem>
                    {campaigns.map(campaign => (
                      <SelectItem key={campaign.id} value={campaign.id.toString()}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Période</label>
                <Select value={timeFilter} onValueChange={setTimeFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Toutes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    <SelectItem value="today">Aujourd'hui</SelectItem>
                    <SelectItem value="week">7 derniers jours</SelectItem>
                    <SelectItem value="month">30 derniers jours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 flex-1 min-w-64">
                <label className="text-sm font-medium">Recherche</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher dans les réponses..."
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={exportToCSV}
                  variant="outline"
                  className="hover:bg-accent"
                  disabled={filteredAnswers.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </Button>
                <Button
                  onClick={exportToJSON}
                  variant="outline"
                  className="hover:bg-accent"
                  disabled={filteredAnswers.length === 0}
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
              Réponses ({filteredAnswers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Chargement des réponses...
              </div>
            ) : filteredAnswers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucune réponse trouvée
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campagne</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Question</TableHead>
                      <TableHead>Réponse</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Contact</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAnswers.map((answer) => (
                      <TableRow key={answer.id}>
                        <TableCell className="font-medium">
                          {answer.question.campaign.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant={answer.question.campaign.campaign_type === 'web_survey' ? 'default' : 'secondary'}>
                            {answer.question.campaign.campaign_type === 'web_survey' ? 'Web' : 'Téléphone'}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {answer.question.question_text}
                        </TableCell>
                        <TableCell className="max-w-sm">
                          <div className="truncate" title={answer.answer_text}>
                            {answer.answer_text}
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(answer.answered_at), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          {answer.call?.phone_number || 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}