-- Clean up database by removing unused tables and updating foreign keys

-- First, update the answer table to reference survey_submissions instead of survey_response
-- Drop the existing foreign key if it exists
ALTER TABLE public.answer DROP CONSTRAINT IF EXISTS answer_survey_response_id_fkey;

-- Rename the column to be more clear
ALTER TABLE public.answer RENAME COLUMN survey_response_id TO survey_submission_id;

-- Change the column type to UUID to match survey_submissions.id
ALTER TABLE public.answer ALTER COLUMN survey_submission_id TYPE UUID USING survey_submission_id::text::uuid;

-- Add foreign key constraint to survey_submissions
ALTER TABLE public.answer 
ADD CONSTRAINT answer_survey_submission_id_fkey 
FOREIGN KEY (survey_submission_id) REFERENCES public.survey_submissions(id) ON DELETE CASCADE;

-- Drop the unused tables
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.survey_response CASCADE;

-- Clean up any orphaned RLS policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Campaign owners can view respondent profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow anonymous users to create profiles for surveys" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow anonymous users to update profiles for surveys" ON public.user_profiles;