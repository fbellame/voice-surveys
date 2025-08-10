import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { formatQuestionWithContext } from "@/lib/questionUtils";

export default function CreateCampaign() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Campaign form state
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    description: "",
    campaign_type: "web_survey",
    start_date: "",
    end_date: "",
    intro_prompt: "",
    purpose_explanation: "",
    greeting: "",
    closing: "",
    room_pattern: "",
    campaign_uri: ""
  });

  // Questions state with context
  const [questions, setQuestions] = useState([{ 
    question_text: "", 
    context: "",
    question_order: 1 
  }]);

  const handleCampaignFormChange = (field: string, value: string) => {
    setCampaignForm(prev => {
      const updated = { ...prev, [field]: value };
      // Auto-generate room_pattern and campaign_uri when name changes
      if (field === 'name' && value.trim()) {
        const slug = value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        updated.room_pattern = `${slug}-`;
        updated.campaign_uri = slug;
      }
      return updated;
    });
  };

  const handleQuestionChange = (index: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[index].question_text = value;
    setQuestions(newQuestions);
  };

  const handleContextChange = (index: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[index].context = value;
    setQuestions(newQuestions);
  };

  const addQuestion = () => {
    setQuestions([...questions, { 
      question_text: "", 
      context: "",
      question_order: questions.length + 1 
    }]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      const newQuestions = questions.filter((_, i) => i !== index);
      // Reorder questions
      newQuestions.forEach((q, i) => q.question_order = i + 1);
      setQuestions(newQuestions);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!campaignForm.start_date.trim()) {
      toast({
        title: "Validation Error",
        description: "Start date is required",
        variant: "destructive",
      });
      return;
    }
    
    if (!campaignForm.end_date.trim()) {
      toast({
        title: "Validation Error",
        description: "End date is required",
        variant: "destructive",
      });
      return;
    }
    
    // Validate that end date is after start date
    if (new Date(campaignForm.end_date) <= new Date(campaignForm.start_date)) {
      toast({
        title: "Validation Error",
        description: "End date must be after start date",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);

    try {
      // Create campaign - exclude room_pattern as it's not part of the campaign table
      const { room_pattern, ...campaignData } = campaignForm;
      const { data: campaign, error: campaignError } = await supabase
        .from('campaign')
        .insert([{ ...campaignData, user_id: user?.id }])
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Create questions with context formatting
      const questionsToInsert = questions
        .filter(q => q.question_text.trim())
        .map(q => ({
          campaign_id: campaign.id,
          question_text: formatQuestionWithContext(q.question_text, q.context),
          question_order: q.question_order
        }));

      if (questionsToInsert.length > 0) {
        const { error: questionsError } = await supabase
          .from('question')
          .insert(questionsToInsert);

        if (questionsError) throw questionsError;
      }

      // Create room mapping if room pattern is provided
      if (room_pattern.trim()) {
        const { error: roomMappingError } = await supabase
          .from('campaign_room_mapping')
          .insert({
            campaign_id: campaign.id,
            room_pattern: room_pattern,
            is_active: true
          });

        if (roomMappingError) throw roomMappingError;
      }

      toast({
        title: "Success",
        description: "Campaign created successfully",
      });

      navigate('/campaigns');
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast({
        title: "Error",
        description: "Error creating campaign",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout currentPage="campaigns">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/campaigns')}
            className="hover:bg-accent"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">New Campaign</h1>
            <p className="text-muted-foreground mt-2">
              Create a new survey campaign
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Campaign Details */}
          <Card className="bg-gradient-card shadow-card border-0">
            <CardHeader>
              <CardTitle>Campaign Details</CardTitle>
              <CardDescription>
                General campaign information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Campaign Name *</Label>
                  <Input
                    id="name"
                    value={campaignForm.name}
                    onChange={(e) => handleCampaignFormChange('name', e.target.value)}
                    placeholder="Campaign name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={campaignForm.description}
                    onChange={(e) => handleCampaignFormChange('description', e.target.value)}
                    placeholder="Campaign description"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="campaign_type">Campaign Type</Label>
                <Select
                  value={campaignForm.campaign_type}
                  onValueChange={(value) => handleCampaignFormChange('campaign_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="web_survey">Web Survey</SelectItem>
                    <SelectItem value="phone_survey">Phone Survey</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {campaignForm.campaign_type === 'web_survey' 
                    ? 'Online survey with web form'
                    : 'Phone survey with voice questions'
                  }
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={campaignForm.start_date}
                    onChange={(e) => handleCampaignFormChange('start_date', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date *</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={campaignForm.end_date}
                    onChange={(e) => handleCampaignFormChange('end_date', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="greeting">Welcome Message</Label>
                <Textarea
                  id="greeting"
                  value={campaignForm.greeting}
                  onChange={(e) => handleCampaignFormChange('greeting', e.target.value)}
                  placeholder="Welcome message for participants"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="intro_prompt">Introduction Prompt</Label>
                <Textarea
                  id="intro_prompt"
                  value={campaignForm.intro_prompt}
                  onChange={(e) => handleCampaignFormChange('intro_prompt', e.target.value)}
                  placeholder="Introduction prompt"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="purpose_explanation">Purpose Explanation</Label>
                <Textarea
                  id="purpose_explanation"
                  value={campaignForm.purpose_explanation}
                  onChange={(e) => handleCampaignFormChange('purpose_explanation', e.target.value)}
                  placeholder="Explanation of the campaign purpose"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="closing">Closing Message</Label>
                <Textarea
                  id="closing"
                  value={campaignForm.closing}
                  onChange={(e) => handleCampaignFormChange('closing', e.target.value)}
                  placeholder="Closing message"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="room_pattern">Room Pattern</Label>
                <Input
                  id="room_pattern"
                  value={campaignForm.room_pattern}
                  onChange={(e) => handleCampaignFormChange('room_pattern', e.target.value)}
                  placeholder="ex: campaign-name-, survey-test-"
                />
                <p className="text-sm text-muted-foreground">
                  Pattern to identify rooms associated with this campaign
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="campaign_uri">Campaign URI</Label>
                <Input
                  id="campaign_uri"
                  value={campaignForm.campaign_uri}
                  onChange={(e) => handleCampaignFormChange('campaign_uri', e.target.value)}
                  placeholder="ex: campaign-name, survey-test"
                />
                <p className="text-sm text-muted-foreground">
                  Unique URI to access the campaign (will be generated automatically)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Questions */}
          <Card className="bg-gradient-card shadow-card border-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Questions</CardTitle>
                  <CardDescription>
                    {campaignForm.campaign_type === 'web_survey' 
                      ? 'Questions to include in the survey'
                      : 'Questions to ask during calls'
                    }
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addQuestion}
                  className="hover:bg-accent"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Question
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {questions.map((question, index) => (
                <div key={index} className="space-y-3 p-4 border rounded-lg bg-background/50">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label htmlFor={`question-${index}`}>Question {index + 1}</Label>
                      <Input
                        id={`question-${index}`}
                        value={question.question_text}
                        onChange={(e) => handleQuestionChange(index, e.target.value)}
                        placeholder={`Question ${index + 1}`}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeQuestion(index)}
                      disabled={questions.length === 1}
                      className="hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex-1">
                    <Label htmlFor={`context-${index}`}>Context (Optional)</Label>
                    <Textarea
                      id={`context-${index}`}
                      value={question.context}
                      onChange={(e) => handleContextChange(index, e.target.value)}
                      placeholder="Provide context to help explain this question..."
                      rows={2}
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      This context will be used to provide additional information about the question
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>


          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/campaigns')}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !campaignForm.name.trim() || !campaignForm.start_date.trim() || !campaignForm.end_date.trim()}
              className="bg-gradient-primary hover:opacity-90 transition-opacity"
            >
              {loading ? "Creating..." : "Create Campaign"}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}