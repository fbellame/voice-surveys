import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";


export default function CreateCampaign() {
  const navigate = useNavigate();
  const { toast } = useToast();
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
    room_pattern: ""
  });

  // Questions state
  const [questions, setQuestions] = useState([{ question_text: "", question_order: 1 }]);

  const handleCampaignFormChange = (field: string, value: string) => {
    setCampaignForm(prev => ({ ...prev, [field]: value }));
  };

  const handleQuestionChange = (index: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[index].question_text = value;
    setQuestions(newQuestions);
  };

  const addQuestion = () => {
    setQuestions([...questions, { question_text: "", question_order: questions.length + 1 }]);
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
    setLoading(true);

    try {
      // Create campaign - exclude room_pattern as it's not part of the campaign table
      const { room_pattern, ...campaignData } = campaignForm;
      const { data: campaign, error: campaignError } = await supabase
        .from('campaign')
        .insert([campaignData])
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Create questions
      const questionsToInsert = questions
        .filter(q => q.question_text.trim())
        .map(q => ({
          campaign_id: campaign.id,
          question_text: q.question_text,
          question_order: q.question_order
        }));

      if (questionsToInsert.length > 0) {
        const { error: questionsError } = await supabase
          .from('question')
          .insert(questionsToInsert);

        if (questionsError) throw questionsError;
      }

      // Create room mapping if room pattern is provided
      if (campaignForm.room_pattern.trim()) {
        const { error: roomMappingError } = await supabase
          .from('campaign_room_mapping')
          .insert({
            campaign_id: campaign.id,
            room_pattern: campaignForm.room_pattern,
            is_active: true
          });

        if (roomMappingError) throw roomMappingError;
      }


      toast({
        title: "Succès",
        description: "La campagne a été créée avec succès",
      });

      navigate('/campaigns');
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la création de la campagne",
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
            Retour
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Nouvelle Campagne</h1>
            <p className="text-muted-foreground mt-2">
              Créer une nouvelle campagne de sondage
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Campaign Details */}
          <Card className="bg-gradient-card shadow-card border-0">
            <CardHeader>
              <CardTitle>Détails de la Campagne</CardTitle>
              <CardDescription>
                Informations générales sur la campagne
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom de la campagne *</Label>
                  <Input
                    id="name"
                    value={campaignForm.name}
                    onChange={(e) => handleCampaignFormChange('name', e.target.value)}
                    placeholder="Nom de la campagne"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={campaignForm.description}
                    onChange={(e) => handleCampaignFormChange('description', e.target.value)}
                    placeholder="Description de la campagne"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="campaign_type">Type de campagne</Label>
                <Select
                  value={campaignForm.campaign_type}
                  onValueChange={(value) => handleCampaignFormChange('campaign_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner le type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="web_survey">Sondage Web</SelectItem>
                    <SelectItem value="phone_survey">Sondage Téléphonique</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {campaignForm.campaign_type === 'web_survey' 
                    ? 'Sondage en ligne avec formulaire web'
                    : 'Sondage par téléphone avec questions vocales'
                  }
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Date de début</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={campaignForm.start_date}
                    onChange={(e) => handleCampaignFormChange('start_date', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">Date de fin</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={campaignForm.end_date}
                    onChange={(e) => handleCampaignFormChange('end_date', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="greeting">Message d'accueil</Label>
                <Textarea
                  id="greeting"
                  value={campaignForm.greeting}
                  onChange={(e) => handleCampaignFormChange('greeting', e.target.value)}
                  placeholder="Message d'accueil pour les participants"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="intro_prompt">Prompt d'introduction</Label>
                <Textarea
                  id="intro_prompt"
                  value={campaignForm.intro_prompt}
                  onChange={(e) => handleCampaignFormChange('intro_prompt', e.target.value)}
                  placeholder="Prompt d'introduction"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="purpose_explanation">Explication du but</Label>
                <Textarea
                  id="purpose_explanation"
                  value={campaignForm.purpose_explanation}
                  onChange={(e) => handleCampaignFormChange('purpose_explanation', e.target.value)}
                  placeholder="Explication du but de la campagne"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="closing">Message de fermeture</Label>
                <Textarea
                  id="closing"
                  value={campaignForm.closing}
                  onChange={(e) => handleCampaignFormChange('closing', e.target.value)}
                  placeholder="Message de fermeture"
                />
              </div>

              {campaignForm.campaign_type === 'phone_survey' && (
                <div className="space-y-2">
                  <Label htmlFor="room_pattern">Modèle de salle</Label>
                  <Input
                    id="room_pattern"
                    value={campaignForm.room_pattern}
                    onChange={(e) => handleCampaignFormChange('room_pattern', e.target.value)}
                    placeholder="ex: call-campaign1-, call-survey-"
                  />
                  <p className="text-sm text-muted-foreground">
                    Modèle pour identifier les salles associées à cette campagne
                  </p>
                </div>
              )}
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
                      ? 'Questions à inclure dans le sondage'
                      : 'Questions à poser pendant les appels'
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
                  Ajouter une question
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {questions.map((question, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="flex-1">
                    <Input
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
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={loading || !campaignForm.name.trim()}
              className="bg-gradient-primary hover:opacity-90 transition-opacity"
            >
              {loading ? "Création..." : "Créer la campagne"}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}