-- Migration: Add RLS policies for anonymous quiz access via quiz_links
-- This allows anonymous users to view quizzes and questions when accessing via an active quiz link
-- Note: We use SECURITY DEFINER functions to avoid infinite recursion in RLS policies

-- First, create a function to check if a quiz has an active link (bypasses RLS)
CREATE OR REPLACE FUNCTION public.has_active_quiz_link(quiz_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM quiz_links
    WHERE quiz_links.quiz_id = quiz_uuid
    AND quiz_links.is_active = true
    AND (quiz_links.expires_at IS NULL OR quiz_links.expires_at > NOW())
  );
$$;

-- Allow anonymous access to quizzes that have active quiz links
CREATE POLICY "Anyone can view quizzes with active quiz links (for anonymous access)"
  ON quizzes FOR SELECT
  USING (public.has_active_quiz_link(quizzes.id));

-- Allow anonymous access to questions for quizzes that have active quiz links
CREATE POLICY "Anyone can view questions for quizzes with active quiz links (for anonymous access)"
  ON questions FOR SELECT
  USING (public.has_active_quiz_link(questions.quiz_id));

