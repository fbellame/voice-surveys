import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Upload, FileText, X } from "lucide-react";

interface Question {
  question_text: string;
  question_order: number;
  is_quiz_question: boolean;
  correct_answer: string;
  points: number;
  explanation: string;
}

export default function CreateLesson() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string>("");
  
  // Lesson form state
  const [lessonForm, setLessonForm] = useState({
    name: "",
    description: "",
    start_date: "",
    end_date: "",
    intro_prompt: "",
    purpose_explanation: "",
    greeting: "",
    closing: "",
    room_pattern: "",
    lesson_uri: "",
    document_url: ""
  });

  // Questions state
  const [questions, setQuestions] = useState<Question[]>([{ 
    question_text: "", 
    question_order: 1,
    is_quiz_question: false,
    correct_answer: "",
    points: 1,
    explanation: ""
  }]);

  const handleLessonFormChange = (field: string, value: string) => {
    setLessonForm(prev => {
      const updated = { ...prev, [field]: value };
      // Auto-generate room_pattern and lesson_uri when name changes
      if (field === 'name' && value.trim()) {
        const slug = value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        updated.room_pattern = `${slug}-`;
        updated.lesson_uri = slug;
      }
      return updated;
    });
  };

  const handleQuestionChange = (index: number, field: keyof Question, value: string | number | boolean) => {
    const newQuestions = [...questions];
    (newQuestions[index] as any)[field] = value;
    setQuestions(newQuestions);
  };

  const addQuestion = () => {
    setQuestions([...questions, { 
      question_text: "", 
      question_order: questions.length + 1,
      is_quiz_question: false,
      correct_answer: "",
      points: 1,
      explanation: ""
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

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast({
        title: "Invalid File",
        description: "Please upload a PDF file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast({
        title: "File Too Large",
        description: "Please upload a PDF file smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    setUploadedFile(file);
    setUploading(true);

    try {
      // Extract text from PDF using a simple approach
      // In production, you might want to use a library like pdf-parse or pdf.js
      // For now, we'll upload the file and extract text on the server side
      const fileReader = new FileReader();
      
      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `lessons/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('lesson-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('lesson-documents')
        .getPublicUrl(filePath);

      // For now, we'll store the file URL and extract text later via an edge function
      // Or you can use a client-side PDF parser here
      toast({
        title: "File Uploaded",
        description: "PDF uploaded successfully. Text extraction will happen on the server.",
      });

      // Store file info for later use
      setLessonForm(prev => ({
        ...prev,
        document_url: publicUrl
      }));

    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload Error",
        description: "Failed to upload PDF file",
        variant: "destructive",
      });
      setUploadedFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!lessonForm.start_date.trim()) {
      toast({
        title: "Validation Error",
        description: "Start date is required",
        variant: "destructive",
      });
      return;
    }
    
    if (!lessonForm.end_date.trim()) {
      toast({
        title: "Validation Error",
        description: "End date is required",
        variant: "destructive",
      });
      return;
    }
    
    // Validate that end date is after start date
    if (new Date(lessonForm.end_date) <= new Date(lessonForm.start_date)) {
      toast({
        title: "Validation Error",
        description: "End date must be after start date",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);

    try {
      // Create lesson
      const { room_pattern, ...lessonData } = lessonForm;
      const { data: lesson, error: lessonError } = await supabase
        .from('lesson')
        .insert([{ ...lessonData, user_id: user?.id }])
        .select()
        .single();

      if (lessonError) throw lessonError;

      // Create questions
      const questionsToInsert = questions
        .filter(q => q.question_text.trim())
        .map(q => ({
          lesson_id: lesson.id,
          question_text: q.question_text,
          question_order: q.question_order,
          is_quiz_question: q.is_quiz_question,
          correct_answer: q.is_quiz_question ? q.correct_answer : null,
          points: q.is_quiz_question ? q.points : 1,
          explanation: q.is_quiz_question ? q.explanation : null
        }));

      if (questionsToInsert.length > 0) {
        const { error: questionsError } = await supabase
          .from('lesson_question')
          .insert(questionsToInsert);

        if (questionsError) throw questionsError;
      }

      // Create room mapping if room pattern is provided
      if (room_pattern.trim()) {
        const { error: roomMappingError } = await supabase
          .from('lesson_room_mapping')
          .insert({
            lesson_id: lesson.id,
            room_pattern: room_pattern,
            is_active: true
          });

        if (roomMappingError) throw roomMappingError;
      }

      // If file was uploaded, create lesson_document record
      if (uploadedFile && lessonForm.document_url) {
        const { error: docError } = await supabase
          .from('lesson_documents')
          .insert({
            lesson_id: lesson.id,
            file_name: uploadedFile.name,
            file_url: lessonForm.document_url,
            file_size: uploadedFile.size,
            mime_type: uploadedFile.type,
            uploaded_by: user?.id
          });

        if (docError) {
          console.error('Error creating document record:', docError);
          // Don't fail the whole operation if document record fails
        }
      }

      toast({
        title: "Success",
        description: "Lesson created successfully",
      });

      navigate('/lessons');
    } catch (error) {
      console.error('Error creating lesson:', error);
      toast({
        title: "Error",
        description: "Error creating lesson",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout currentPage="lessons">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/lessons')}
            className="hover:bg-accent"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">New Lesson</h1>
            <p className="text-muted-foreground mt-2">
              Create a new lesson with quiz questions
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Lesson Details */}
          <Card className="bg-gradient-card shadow-card border-0">
            <CardHeader>
              <CardTitle>Lesson Details</CardTitle>
              <CardDescription>
                General lesson information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Lesson Name *</Label>
                  <Input
                    id="name"
                    value={lessonForm.name}
                    onChange={(e) => handleLessonFormChange('name', e.target.value)}
                    placeholder="Lesson name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={lessonForm.description}
                    onChange={(e) => handleLessonFormChange('description', e.target.value)}
                    placeholder="Lesson description"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={lessonForm.start_date}
                    onChange={(e) => handleLessonFormChange('start_date', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date *</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={lessonForm.end_date}
                    onChange={(e) => handleLessonFormChange('end_date', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="greeting">Welcome Message</Label>
                <Textarea
                  id="greeting"
                  value={lessonForm.greeting}
                  onChange={(e) => handleLessonFormChange('greeting', e.target.value)}
                  placeholder="Welcome message for students"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="intro_prompt">Introduction Prompt</Label>
                <Textarea
                  id="intro_prompt"
                  value={lessonForm.intro_prompt}
                  onChange={(e) => handleLessonFormChange('intro_prompt', e.target.value)}
                  placeholder="Instructions for the AI teacher"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="purpose_explanation">Purpose Explanation</Label>
                <Textarea
                  id="purpose_explanation"
                  value={lessonForm.purpose_explanation}
                  onChange={(e) => handleLessonFormChange('purpose_explanation', e.target.value)}
                  placeholder="Explanation of the lesson purpose"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="closing">Closing Message</Label>
                <Textarea
                  id="closing"
                  value={lessonForm.closing}
                  onChange={(e) => handleLessonFormChange('closing', e.target.value)}
                  placeholder="Closing message"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="room_pattern">Room Pattern</Label>
                <Input
                  id="room_pattern"
                  value={lessonForm.room_pattern}
                  onChange={(e) => handleLessonFormChange('room_pattern', e.target.value)}
                  placeholder="ex: lesson-name-, math-101-"
                />
                <p className="text-sm text-muted-foreground">
                  Pattern to identify rooms associated with this lesson
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lesson_uri">Lesson URI</Label>
                <Input
                  id="lesson_uri"
                  value={lessonForm.lesson_uri}
                  onChange={(e) => handleLessonFormChange('lesson_uri', e.target.value)}
                  placeholder="ex: lesson-name, math-101"
                />
                <p className="text-sm text-muted-foreground">
                  Unique URI to access the lesson (will be generated automatically)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* PDF Document Upload */}
          <Card className="bg-gradient-card shadow-card border-0">
            <CardHeader>
              <CardTitle>Lesson Document</CardTitle>
              <CardDescription>
                Upload a PDF document for this lesson (optional)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>PDF Document</Label>
                <div className="flex items-center gap-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {uploading ? "Uploading..." : "Upload PDF"}
                  </Button>
                  {uploadedFile && (
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4" />
                      <span>{uploadedFile.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setUploadedFile(null);
                          setExtractedText("");
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Upload a PDF document (max 10MB) that will be used as reference material for the lesson
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
                    Add quiz questions with correct answers and explanations
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
                        onChange={(e) => handleQuestionChange(index, 'question_text', e.target.value)}
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
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`quiz-${index}`}
                      checked={question.is_quiz_question}
                      onCheckedChange={(checked) => handleQuestionChange(index, 'is_quiz_question', checked as boolean)}
                    />
                    <Label htmlFor={`quiz-${index}`} className="cursor-pointer">
                      This is a quiz question
                    </Label>
                  </div>

                  {question.is_quiz_question && (
                    <div className="space-y-3 pl-6 border-l-2 border-primary">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`correct-${index}`}>Correct Answer *</Label>
                          <Input
                            id={`correct-${index}`}
                            value={question.correct_answer}
                            onChange={(e) => handleQuestionChange(index, 'correct_answer', e.target.value)}
                            placeholder="Correct answer"
                            required={question.is_quiz_question}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`points-${index}`}>Points</Label>
                          <Input
                            id={`points-${index}`}
                            type="number"
                            min="1"
                            value={question.points}
                            onChange={(e) => handleQuestionChange(index, 'points', parseInt(e.target.value) || 1)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`explanation-${index}`}>Explanation</Label>
                        <Textarea
                          id={`explanation-${index}`}
                          value={question.explanation}
                          onChange={(e) => handleQuestionChange(index, 'explanation', e.target.value)}
                          placeholder="Explanation shown after answering"
                          rows={2}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/lessons')}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !lessonForm.name.trim() || !lessonForm.start_date.trim() || !lessonForm.end_date.trim()}
              className="bg-gradient-primary hover:opacity-90 transition-opacity"
            >
              {loading ? "Creating..." : "Create Lesson"}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}

