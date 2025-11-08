import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowLeft,
  User,
  Mail,
  Calendar,
  BookOpen,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock
} from "lucide-react";

interface StudentProfile {
  id: number;
  full_name: string;
  email: string | null;
  created_at: string;
}

interface LessonPerformance {
  id: number;
  lesson_id: number;
  lesson_name: string;
  total_questions: number;
  correct_answers: number;
  total_points: number;
  points_earned: number;
  score_percentage: number;
  completion_time_seconds: number | null;
  started_at: string;
  completed_at: string;
}

interface LessonAnswer {
  id: number;
  lesson_question_id: number;
  question_text: string;
  answer_text: string;
  is_correct: boolean | null;
  points_earned: number;
  feedback: string | null;
  is_quiz_question: boolean;
}

export default function StudentPerformance() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [performances, setPerformances] = useState<LessonPerformance[]>([]);
  const [selectedPerformance, setSelectedPerformance] = useState<LessonPerformance | null>(null);
  const [answers, setAnswers] = useState<LessonAnswer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchStudentData();
    }
  }, [id, user]);

  const fetchStudentData = async () => {
    if (!id || !user?.id) {
      setLoading(false);
      return;
    }

    try {
      // Fetch student profile
      const { data: studentData, error: studentError } = await supabase
        .from('student_profiles')
        .select('*')
        .eq('id', parseInt(id))
        .single();

      if (studentError) throw studentError;
      setStudent(studentData);

      // Fetch performance records
      const { data: perfData, error: perfError } = await supabase
        .from('lesson_performance')
        .select(`
          *,
          lesson:lesson_id (
            id,
            name
          )
        `)
        .eq('student_profile_id', parseInt(id))
        .order('completed_at', { ascending: false });

      if (perfError) throw perfError;

      const performancesWithLessonNames: LessonPerformance[] = perfData.map((p: any) => ({
        id: p.id,
        lesson_id: p.lesson_id,
        lesson_name: p.lesson?.name || 'Unknown Lesson',
        total_questions: p.total_questions,
        correct_answers: p.correct_answers,
        total_points: p.total_points,
        points_earned: p.points_earned,
        score_percentage: parseFloat(p.score_percentage?.toString() || '0'),
        completion_time_seconds: p.completion_time_seconds,
        started_at: p.started_at,
        completed_at: p.completed_at
      }));

      setPerformances(performancesWithLessonNames);
    } catch (error: any) {
      console.error('Error fetching student data:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load student data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAnswersForPerformance = async (performance: LessonPerformance) => {
    try {
      // Get the submission ID from performance
      const { data: submissionData, error: subError } = await supabase
        .from('lesson_submissions')
        .select('id')
        .eq('lesson_id', performance.lesson_id)
        .eq('student_profile_id', student?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (subError) throw subError;

      // Fetch answers for this submission
      const { data: answersData, error: answersError } = await supabase
        .from('lesson_answer')
        .select(`
          *,
          lesson_question:lesson_question_id (
            question_text,
            is_quiz_question
          )
        `)
        .eq('lesson_submission_id', submissionData.id)
        .order('created_at', { ascending: true });

      if (answersError) throw answersError;

      const answersWithQuestionInfo: LessonAnswer[] = answersData.map((a: any) => ({
        id: a.id,
        lesson_question_id: a.lesson_question_id,
        question_text: a.lesson_question?.question_text || 'Unknown Question',
        answer_text: a.answer_text,
        is_correct: a.is_correct,
        points_earned: a.points_earned || 0,
        feedback: a.feedback,
        is_quiz_question: a.lesson_question?.is_quiz_question || false
      }));

      setAnswers(answersWithQuestionInfo);
      setSelectedPerformance(performance);
    } catch (error: any) {
      console.error('Error fetching answers:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load answers",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <Layout currentPage="students">
        <div className="flex items-center justify-center min-h-[400px]">
          <p>Loading student data...</p>
        </div>
      </Layout>
    );
  }

  if (!student) {
    return (
      <Layout currentPage="students">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Student not found</p>
            <Button onClick={() => navigate('/students')} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Students
            </Button>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  const overallAvgScore = performances.length > 0
    ? performances.reduce((sum, p) => sum + p.score_percentage, 0) / performances.length
    : 0;

  return (
    <Layout currentPage="students">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="ghost"
              onClick={() => navigate('/students')}
              className="mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Students
            </Button>
            <h1 className="text-3xl font-bold">{student.full_name}</h1>
            <p className="text-muted-foreground mt-1">
              View detailed performance and progress
            </p>
          </div>
        </div>

        {/* Student Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Student Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Full Name</p>
                  <p className="text-sm text-muted-foreground">{student.full_name}</p>
                </div>
              </div>
              {student.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">{student.email}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Member Since</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(student.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Lessons Completed</p>
                  <p className="text-sm text-muted-foreground">{performances.length}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Overall Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(overallAvgScore)}%</div>
              <p className="text-xs text-muted-foreground">Across all lessons</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Questions</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {performances.reduce((sum, p) => sum + p.total_questions, 0)}
              </div>
              <p className="text-xs text-muted-foreground">Questions answered</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Correct Answers</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {performances.reduce((sum, p) => sum + p.correct_answers, 0)}
              </div>
              <p className="text-xs text-muted-foreground">Total correct</p>
            </CardContent>
          </Card>
        </div>

        {/* Performance History */}
        <Card>
          <CardHeader>
            <CardTitle>Lesson Performance History</CardTitle>
            <CardDescription>Click on a lesson to view detailed answers</CardDescription>
          </CardHeader>
          <CardContent>
            {performances.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No lesson completions yet
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lesson</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Correct</TableHead>
                      <TableHead>Points</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {performances.map((perf) => (
                      <TableRow key={perf.id}>
                        <TableCell className="font-medium">{perf.lesson_name}</TableCell>
                        <TableCell>
                          <Badge variant={perf.score_percentage >= 70 ? "default" : perf.score_percentage >= 50 ? "secondary" : "destructive"}>
                            {Math.round(perf.score_percentage)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {perf.correct_answers}/{perf.total_questions}
                        </TableCell>
                        <TableCell>
                          {perf.points_earned}/{perf.total_points}
                        </TableCell>
                        <TableCell>
                          {perf.completion_time_seconds ? (
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {Math.round(perf.completion_time_seconds / 60)} min
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(perf.completed_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => fetchAnswersForPerformance(perf)}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Answer Details Modal */}
        {selectedPerformance && answers.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{selectedPerformance.lesson_name} - Answers</CardTitle>
                  <CardDescription>
                    Score: {Math.round(selectedPerformance.score_percentage)}% | 
                    {selectedPerformance.correct_answers}/{selectedPerformance.total_questions} correct
                  </CardDescription>
                </div>
                <Button variant="ghost" onClick={() => setSelectedPerformance(null)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {answers.map((answer, index) => (
                  <div key={answer.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium">
                          Question {index + 1}: {answer.question_text}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Answer: {answer.answer_text}
                        </p>
                        {answer.is_quiz_question && (
                          <div className="mt-2 flex items-center gap-2">
                            {answer.is_correct ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span className="text-sm text-green-600 font-medium">Correct</span>
                                <Badge variant="default" className="ml-2">
                                  +{answer.points_earned} points
                                </Badge>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-4 w-4 text-red-600" />
                                <span className="text-sm text-red-600 font-medium">Incorrect</span>
                              </>
                            )}
                          </div>
                        )}
                        {answer.feedback && (
                          <p className="text-sm text-muted-foreground mt-2 italic">
                            {answer.feedback}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

