import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SimpleQuiz } from '@/components/audio/SimpleQuiz';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import type { User, Session } from '@supabase/supabase-js';

interface Quiz {
  id: string;
  title: string;
  document_id: string;
  difficulty_mix: any;
  settings: any;
}

interface Question {
  id: string;
  quiz_id: string;
  type: 'mcq' | 'true_false' | 'short_answer' | 'cloze';
  prompt: string;
  options: any;
  correct_answer: any;
  rationale: string | null;
  bloom_level: string | null;
}

interface QuizLink {
  id: string;
  quiz_id: string;
  unique_token: string;
  name: string | null;
  is_active: boolean;
  max_attempts: number | null;
  expires_at: string | null;
  created_by: string;
}

const QuizPage = () => {
  const { quizToken } = useParams<{ quizToken: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [quizLink, setQuizLink] = useState<QuizLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  // Handle both route parameter and query parameter for flexibility
  const rawToken = quizToken || searchParams.get('token');
  // Handle URL encoding: + signs in URLs become spaces when decoded, so convert them back
  const token = rawToken ? rawToken.replace(/ /g, '+') : null;

  useEffect(() => {
    if (!token) {
      setError('No quiz token provided');
      setLoading(false);
      return;
    }

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    // Always try to load quiz data (works for both authenticated and anonymous)
    const loadQuiz = async () => {
      try {
        console.log('Loading quiz with token:', token);
        
        // First, check if this is a quiz link
        const { data: linkData, error: linkError } = await supabase
          .from('quiz_links')
          .select('id, quiz_id, unique_token, name, is_active, max_attempts, expires_at, created_by')
          .eq('unique_token', token)
          .eq('is_active', true)
          .maybeSingle();

        console.log('Quiz link query result:', { linkData, linkError });

        if (linkError) {
          console.error('Error fetching quiz link:', linkError);
          setError(`Error loading quiz link: ${linkError.message}`);
          setLoading(false);
          return;
        }

        if (!linkData) {
          console.log('Quiz link not found or inactive');
          setError('Quiz link not found or inactive');
          setLoading(false);
          return;
        }

        // Check if link has expired
        if (linkData.expires_at && new Date(linkData.expires_at) < new Date()) {
          setError('This quiz link has expired');
          setLoading(false);
          return;
        }

        // Load quiz and questions
        await loadQuizData(linkData);
      } catch (error) {
        console.error('Error loading quiz:', error);
        setError(`Failed to load quiz: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setLoading(false);
      }
    };

    // Check for existing session first
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // Load quiz regardless of auth status (anonymous access is allowed)
      loadQuiz();
    });

    return () => subscription.unsubscribe();
  }, [quizToken, token]);


  const loadQuizData = async (link: QuizLink) => {
    try {
      console.log('Loading quiz data for quiz_id:', link.quiz_id);
      
      // Load quiz with questions
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select(`
          id,
          title,
          document_id,
          difficulty_mix,
          settings,
          questions:questions(id, quiz_id, type, prompt, options, correct_answer, rationale, bloom_level)
        `)
        .eq('id', link.quiz_id)
        .single();

      console.log('Quiz data query result:', { quizData, quizError });

      if (quizError) {
        console.error('Error fetching quiz:', quizError);
        setError(`Error loading quiz: ${quizError.message}. This might be due to missing RLS policies. Please ensure the migration 'add_anonymous_quiz_access' has been applied.`);
        setLoading(false);
        return;
      }

      if (!quizData) {
        console.log('Quiz not found');
        setError('Quiz not found');
        setLoading(false);
        return;
      }

      console.log('Quiz loaded successfully:', quizData);
      console.log('Questions count:', quizData.questions?.length || 0);

      setQuiz({
        id: quizData.id,
        title: quizData.title,
        document_id: quizData.document_id,
        difficulty_mix: quizData.difficulty_mix,
        settings: quizData.settings,
      });
      setQuestions(quizData.questions || []);
      setQuizLink(link);
      setLoading(false);
    } catch (err) {
      console.error('Error loading quiz data:', err);
      setError(`Failed to load quiz: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setLoading(false);
    }
  };


  const handleComplete = async () => {
    setQuizCompleted(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <p>Loading quiz...</p>
        </Card>
      </div>
    );
  }

  if (error || (!quiz && !quizLink)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold">Quiz Not Found</h1>
          <p className="text-muted-foreground">{error || 'The requested quiz could not be found.'}</p>
          <Button onClick={() => navigate('/')} variant="outline" className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Card>
      </div>
    );
  }

  if (quizCompleted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center space-y-6">
          <div className="mx-auto h-16 w-16 bg-gradient-primary rounded-full flex items-center justify-center mb-6">
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Quiz Complete!</h1>
            <p className="text-muted-foreground">
              Thank you for completing the quiz "{quiz?.title}".
            </p>
            <p className="text-sm text-muted-foreground">
              Great job! Keep up the excellent work.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <SimpleQuiz 
      quiz={quiz}
      quizLink={quizLink}
      questions={questions}
      onComplete={handleComplete} 
    />
  );
};

export default QuizPage;

