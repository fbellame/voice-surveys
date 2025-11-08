import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { StatsCard } from "@/components/StatsCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  BookOpen, 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Play,
  Pause,
  Calendar,
  Link,
  FileText
} from "lucide-react";

interface LessonWithStats {
  id: number;
  name: string;
  description: string | null;
  lesson_uri: string | null;
  start_date: string | null;
  end_date: string | null;
  status: "active" | "draft" | "completed";
  questions: number;
  quiz_questions: number;
  students: number;
  avg_score: number | null;
}

export default function Lessons() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [lessons, setLessons] = useState<LessonWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLessons = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      
      try {
        // Fetch lessons
        const { data: lessonsData, error: lessonsError } = await supabase
          .from('lesson')
          .select('*')
          .eq('user_id', user?.id);

        if (lessonsError) throw lessonsError;

        // Fetch question counts per lesson
        const { data: questionCounts, error: questionError } = await supabase
          .from('lesson_question')
          .select('lesson_id, is_quiz_question');

        if (questionError) throw questionError;

        // Fetch performance data to get student counts and average scores
        const { data: performanceData, error: perfError } = await supabase
          .from('lesson_performance')
          .select('lesson_id, score_percentage');

        if (perfError) throw perfError;

        // Process the data
        const lessonsWithStats: LessonWithStats[] = lessonsData.map(lesson => {
          const questionsForLesson = questionCounts.filter(q => q.lesson_id === lesson.id);
          const totalQuestions = questionsForLesson.length;
          const quizQuestions = questionsForLesson.filter(q => q.is_quiz_question).length;
          
          const performancesForLesson = performanceData?.filter(p => p.lesson_id === lesson.id) || [];
          const studentCount = performancesForLesson.length;
          const avgScore = performancesForLesson.length > 0
            ? performancesForLesson.reduce((sum, p) => sum + (parseFloat(p.score_percentage?.toString() || '0') || 0), 0) / performancesForLesson.length
            : null;

          // Determine status based on dates
          const now = new Date();
          const startDate = lesson.start_date ? new Date(lesson.start_date) : null;
          const endDate = lesson.end_date ? new Date(lesson.end_date) : null;
          
          let status: "active" | "draft" | "completed" = "draft";
          if (startDate && endDate) {
            if (now >= startDate && now <= endDate) {
              status = "active";
            } else if (now > endDate) {
              status = "completed";
            }
          }

          return {
            id: lesson.id,
            name: lesson.name,
            description: lesson.description,
            lesson_uri: lesson.lesson_uri,
            start_date: lesson.start_date,
            end_date: lesson.end_date,
            status,
            questions: totalQuestions,
            quiz_questions: quizQuestions,
            students: studentCount,
            avg_score: avgScore
          };
        });

        setLessons(lessonsWithStats);
      } catch (error) {
        console.error('Error fetching lessons:', error);
        toast({
          title: "Error",
          description: "Failed to load lessons",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchLessons();
  }, [user, toast]);

  const deleteLesson = async (lessonId: number) => {
    try {
      const { error } = await supabase
        .from('lesson')
        .delete()
        .eq('id', lessonId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Lesson deleted successfully",
      });

      // Refresh lessons
      setLessons(lessons.filter(l => l.id !== lessonId));
    } catch (error) {
      console.error('Error deleting lesson:', error);
      toast({
        title: "Error",
        description: "Failed to delete lesson",
        variant: "destructive",
      });
    }
  };

  const totalLessons = lessons.length;
  const activeLessons = lessons.filter(l => l.status === 'active').length;
  const totalStudents = lessons.reduce((sum, l) => sum + l.students, 0);
  const avgScoreAll = lessons.length > 0
    ? lessons.reduce((sum, l) => sum + (l.avg_score || 0), 0) / lessons.length
    : 0;

  if (loading) {
    return (
      <Layout currentPage="lessons">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout currentPage="lessons">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Lessons Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Manage your lessons, track student performance, and view analytics
            </p>
          </div>
          <Button 
            onClick={() => navigate('/lessons/new')}
            className="bg-gradient-primary hover:opacity-90 transition-opacity"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Lesson
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Lessons"
            value={totalLessons}
            icon={BookOpen}
          />
          <StatsCard
            title="Active Lessons"
            value={activeLessons}
            icon={Play}
          />
          <StatsCard
            title="Total Students"
            value={totalStudents}
            icon={Users}
          />
          <StatsCard
            title="Avg Score"
            value={avgScoreAll > 0 ? `${avgScoreAll.toFixed(1)}%` : 'N/A'}
            icon={FileText}
          />
        </div>

        {/* Lessons Table */}
        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle>Lessons</CardTitle>
            <CardDescription>
              Manage your lessons and view student performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lessons.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No lessons yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first lesson to start teaching students
                </p>
                <Button
                  onClick={() => navigate('/lessons/new')}
                  className="bg-gradient-primary hover:opacity-90"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Lesson
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {lessons.map((lesson) => (
                  <Card key={lesson.id} className="border border-border">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-semibold">{lesson.name}</h3>
                            <Badge variant={
                              lesson.status === 'active' ? 'default' : 
                              lesson.status === 'completed' ? 'secondary' : 'outline'
                            }>
                              {lesson.status === 'active' && <Play className="h-3 w-3 mr-1" />}
                              {lesson.status === 'completed' && <Pause className="h-3 w-3 mr-1" />}
                              {lesson.status === 'draft' && <Calendar className="h-3 w-3 mr-1" />}
                              {lesson.status.charAt(0).toUpperCase() + lesson.status.slice(1)}
                            </Badge>
                          </div>
                          {lesson.description && (
                            <p className="text-muted-foreground mb-2">{lesson.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{lesson.questions} questions ({lesson.quiz_questions} quiz)</span>
                            <span>{lesson.students} students</span>
                            {lesson.avg_score !== null && (
                              <span>Avg: {lesson.avg_score.toFixed(1)}%</span>
                            )}
                            {lesson.start_date && (
                              <span>Start: {new Date(lesson.start_date).toLocaleDateString()}</span>
                            )}
                            {lesson.end_date && (
                              <span>End: {new Date(lesson.end_date).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/lessons/${lesson.id}/performance`)}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Performance
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/lessons/edit/${lesson.id}`)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Lesson</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{lesson.name}"? This action cannot be undone and will delete all associated data including questions, student submissions, and performance records.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteLesson(lesson.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete Lesson
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
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

