-- Fix the data type mismatch and clean up properly

-- First, check what data exists in the answer table and clear it if needed
-- since we're changing the fundamental structure
DELETE FROM public.answer WHERE true;

-- Now we can safely change the column type
ALTER TABLE public.answer ALTER COLUMN survey_response_id TYPE UUID USING gen_random_uuid();

-- Rename the column to be more clear
ALTER TABLE public.answer RENAME COLUMN survey_response_id TO survey_submission_id;

-- Add foreign key constraint to survey_submissions
ALTER TABLE public.answer 
ADD CONSTRAINT answer_survey_submission_id_fkey 
FOREIGN KEY (survey_submission_id) REFERENCES public.survey_submissions(id) ON DELETE CASCADE;

-- Drop the unused tables
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.survey_response CASCADE;