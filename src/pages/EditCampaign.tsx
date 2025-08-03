import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { Save, Plus, Trash2, ArrowLeft } from "lucide-react";

interface Campaign {
  id: number;
  name: string;
  description: string | null;
  campaign_type: string;
  start_date: string | null;
  end_date: string | null;
  greeting: string | null;
  intro_prompt: string | null;
  purpose_explanation: string | null;
  closing: string | null;
  campaign_uri: string | null;
}

interface Question {
  id: number;
  question_text: string;
  question_order: number;
  campaign_id: number;
}

interface CampaignFormData {
  name: string;
  description: string;
  campaign_type: string;
  start_date: string;
  end_date: string;
  greeting: string;
  intro_prompt: string;
  purpose_explanation: string;
  closing: string;
  room_pattern: string;
  campaign_uri: string;
}

export default function EditCampaign() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [roomPattern, setRoomPattern] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const form = useForm<CampaignFormData>();

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      try {
        // Fetch campaign
        const { data: campaignData, error: campaignError } = await supabase
          .from('campaign')
          .select('*')
          .eq('id', parseInt(id))
          .single();

        if (campaignError) throw campaignError;

        // Fetch questions
        const { data: questionsData, error: questionsError } = await supabase
          .from('question')
          .select('*')
          .eq('campaign_id', parseInt(id))
          .order('question_order');

        if (questionsError) throw questionsError;

        // Fetch room mapping
        const { data: roomMappingData, error: roomMappingError } = await supabase
          .from('campaign_room_mapping')
          .select('room_pattern')
          .eq('campaign_id', parseInt(id))
          .eq('is_active', true)
          .maybeSingle();

        if (roomMappingError) throw roomMappingError;

        setCampaign({...(campaignData as any), campaign_uri: (campaignData as any).campaign_uri || null});
        setQuestions(questionsData || []);
        setRoomPattern(roomMappingData?.room_pattern || '');

        // Set form values
        form.reset({
          name: campaignData.name,
          description: campaignData.description || '',
          campaign_type: campaignData.campaign_type || 'web_survey',
          start_date: campaignData.start_date || '',
          end_date: campaignData.end_date || '',
          greeting: campaignData.greeting || '',
          intro_prompt: campaignData.intro_prompt || '',
          purpose_explanation: campaignData.purpose_explanation || '',
          closing: campaignData.closing || '',
          room_pattern: roomMappingData?.room_pattern || '',
          campaign_uri: (campaignData as any).campaign_uri || '',
        });

      } catch (error) {
        console.error('Error fetching campaign data:', error);
        toast({
          title: "Error",
          description: "Failed to load campaign data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, form, toast]);

  const onSubmit = async (data: CampaignFormData) => {
    if (!id) return;

    try {
      const { error } = await supabase
        .from('campaign')
        .update({
          name: data.name,
          description: data.description,
          campaign_type: data.campaign_type,
          start_date: data.start_date || null,
          end_date: data.end_date || null,
          greeting: data.greeting,
          intro_prompt: data.intro_prompt,
          purpose_explanation: data.purpose_explanation,
          closing: data.closing,
          campaign_uri: data.campaign_uri,
        })
        .eq('id', parseInt(id));

      if (error) throw error;

      // Update room mapping
      // First, delete existing mappings for this campaign
      await supabase
        .from('campaign_room_mapping')
        .delete()
        .eq('campaign_id', parseInt(id));

      // Then insert new mapping if room pattern is provided
      if (data.room_pattern.trim()) {
        const { error: roomMappingError } = await supabase
          .from('campaign_room_mapping')
          .insert({
            campaign_id: parseInt(id),
            room_pattern: data.room_pattern,
            is_active: true
          });

        if (roomMappingError) throw roomMappingError;
      }

      toast({
        title: "Success",
        description: "Campaign updated successfully",
      });
    } catch (error) {
      console.error('Error updating campaign:', error);
      toast({
        title: "Error",
        description: "Failed to update campaign",
        variant: "destructive",
      });
    }
  };

  const addQuestion = () => {
    const newOrder = Math.max(...questions.map(q => q.question_order), 0) + 1;
    setQuestions([...questions, {
      id: Date.now(), // Temporary ID
      question_text: '',
      question_order: newOrder,
      campaign_id: parseInt(id || '0'),
    }]);
  };

  const updateQuestion = (index: number, text: string) => {
    const updated = [...questions];
    updated[index].question_text = text;
    setQuestions(updated);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const saveQuestions = async () => {
    if (!id) return;

    try {
      // Delete existing questions
      await supabase
        .from('question')
        .delete()
        .eq('campaign_id', parseInt(id));

      // Insert new questions
      const questionsToInsert = questions
        .filter(q => q.question_text.trim())
        .map((q, index) => ({
          campaign_id: parseInt(id),
          question_text: q.question_text,
          question_order: index + 1,
        }));

      if (questionsToInsert.length > 0) {
        const { error } = await supabase
          .from('question')
          .insert(questionsToInsert);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Questions updated successfully",
      });
    } catch (error) {
      console.error('Error saving questions:', error);
      toast({
        title: "Error",
        description: "Failed to save questions",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Layout currentPage="campaigns">
        <div className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Loading campaign...</div>
        </div>
      </Layout>
    );
  }

  if (!campaign) {
    return (
      <Layout currentPage="campaigns">
        <div className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Campaign not found</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout currentPage="campaigns">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/campaigns')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Campaigns
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Edit Campaign</h1>
            <p className="text-muted-foreground mt-2">
              Modify campaign details and questions
            </p>
          </div>
        </div>

        <Tabs defaultValue="details" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Campaign Details</TabsTrigger>
            <TabsTrigger value="questions">Questions</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Information</CardTitle>
                <CardDescription>Update basic campaign details and prompts</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Campaign Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="campaign_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Campaign Type</FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select campaign type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="web_survey">Web Survey</SelectItem>
                                <SelectItem value="phone_survey">Phone Survey</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                      <FormField
                        control={form.control}
                        name="start_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="end_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="greeting"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Greeting</FormLabel>
                          <FormControl>
                            <Textarea {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="intro_prompt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Intro Prompt</FormLabel>
                          <FormControl>
                            <Textarea {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="purpose_explanation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Purpose Explanation</FormLabel>
                          <FormControl>
                            <Textarea {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="closing"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Closing</FormLabel>
                          <FormControl>
                            <Textarea {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {form.watch('campaign_type') === 'phone_survey' && (
                      <FormField
                        control={form.control}
                        name="room_pattern"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Room Pattern</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., call-campaign1-, call-survey-" />
                            </FormControl>
                            <FormMessage />
                            <p className="text-sm text-muted-foreground">
                              Pattern to identify rooms associated with this campaign
                            </p>
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="campaign_uri"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Campaign URI</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., campaign-name, survey-test" />
                          </FormControl>
                          <FormMessage />
                          <p className="text-sm text-muted-foreground">
                            Unique URI to access the campaign
                          </p>
                        </FormItem>
                      )}
                    />

                    <Button type="submit" className="bg-gradient-primary hover:opacity-90">
                      <Save className="h-4 w-4 mr-2" />
                      Save Campaign
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="questions">
            <Card>
              <CardHeader>
                <CardTitle>Survey Questions</CardTitle>
                <CardDescription>Manage the questions for this campaign</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {questions.map((question, index) => (
                  <div key={index} className="flex gap-4 items-center">
                    <div className="flex-1">
                      <Label htmlFor={`question-${index}`}>Question {index + 1}</Label>
                      <Input
                        id={`question-${index}`}
                        value={question.question_text}
                        onChange={(e) => updateQuestion(index, e.target.value)}
                        placeholder="Enter your question..."
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeQuestion(index)}
                      className="hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                
                <div className="flex gap-4">
                  <Button onClick={addQuestion} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Question
                  </Button>
                  <Button onClick={saveQuestions} className="bg-gradient-primary hover:opacity-90">
                    <Save className="h-4 w-4 mr-2" />
                    Save Questions
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}