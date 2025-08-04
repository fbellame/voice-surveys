-- Fix the answer table properly by dropping and recreating with correct types

-- First drop the answer table completely and recreate it with proper UUID reference
DROP TABLE IF EXISTS public.answer CASCADE;

-- Recreate the answer table with correct structure
CREATE TABLE public.answer (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_submission_id UUID NOT NULL,
  question_id BIGINT NOT NULL,
  answer_text TEXT NOT NULL,
  answered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add foreign key constraint to survey_submissions
ALTER TABLE public.answer 
ADD CONSTRAINT answer_survey_submission_id_fkey 
FOREIGN KEY (survey_submission_id) REFERENCES public.survey_submissions(id) ON DELETE CASCADE;

-- Add foreign key constraint to question table
ALTER TABLE public.answer 
ADD CONSTRAINT answer_question_id_fkey 
FOREIGN KEY (question_id) REFERENCES public.question(id) ON DELETE CASCADE;

-- Enable RLS and add policies
ALTER TABLE public.answer ENABLE ROW LEVEL SECURITY;

-- Simple policy: anyone can submit answers
CREATE POLICY "Anyone can submit answers" 
ON public.answer 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_answer_updated_at
  BEFORE UPDATE ON public.answer
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Now drop the unused tables
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.survey_response CASCADE;