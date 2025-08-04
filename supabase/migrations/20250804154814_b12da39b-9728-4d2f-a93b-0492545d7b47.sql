-- Simplify survey data collection with a single table approach
-- Drop the complex RLS and create a simple survey_submissions table

-- Create a simple survey_submissions table that contains everything we need
CREATE TABLE public.survey_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id BIGINT NOT NULL,
  
  -- Participant information
  full_name TEXT,
  email TEXT,
  geography TEXT,
  occupation TEXT,
  phone_number TEXT,
  
  -- Survey session data
  room_name TEXT NOT NULL,
  invitation_token TEXT,
  s3_recording_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  call_timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS but make it simple - anyone can insert and update
ALTER TABLE public.survey_submissions ENABLE ROW LEVEL SECURITY;

-- Simple policy: anyone can submit survey data
CREATE POLICY "Anyone can submit survey data" 
ON public.survey_submissions 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_survey_submissions_updated_at
  BEFORE UPDATE ON public.survey_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();