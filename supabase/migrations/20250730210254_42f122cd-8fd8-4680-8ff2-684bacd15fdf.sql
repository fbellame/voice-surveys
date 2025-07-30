-- Rename call table to survey_response
ALTER TABLE public.call RENAME TO survey_response;

-- Update any indexes that reference the old table name
ALTER INDEX IF EXISTS call_pkey RENAME TO survey_response_pkey;
ALTER SEQUENCE IF EXISTS call_id_seq RENAME TO survey_response_id_seq;

-- Update RLS policies
DROP POLICY IF EXISTS "Allow anonymous read access to call" ON public.survey_response;
DROP POLICY IF EXISTS "Allow anonymous insert access to call" ON public.survey_response;
DROP POLICY IF EXISTS "Allow anonymous update access to call" ON public.survey_response;

CREATE POLICY "Allow anonymous read access to survey_response" 
ON public.survey_response 
FOR SELECT 
USING (true);

CREATE POLICY "Allow anonymous insert access to survey_response" 
ON public.survey_response 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to survey_response" 
ON public.survey_response 
FOR UPDATE 
USING (true);

-- Update answer table to reference survey_response instead of call
ALTER TABLE public.answer RENAME COLUMN call_id TO survey_response_id;