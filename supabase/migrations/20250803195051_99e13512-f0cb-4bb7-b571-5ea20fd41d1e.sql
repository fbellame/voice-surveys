-- Create survey_invitations table to track unique links per user/email
CREATE TABLE public.survey_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id BIGINT NOT NULL REFERENCES public.campaign(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  unique_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'base64url'),
  qr_code_url TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add invitation_token to survey_response to link responses to invitations
ALTER TABLE public.survey_response 
ADD COLUMN invitation_token TEXT REFERENCES public.survey_invitations(unique_token);

-- Enable RLS on survey_invitations
ALTER TABLE public.survey_invitations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for survey_invitations
CREATE POLICY "Allow anonymous read access to survey_invitations" 
ON public.survey_invitations 
FOR SELECT 
USING (true);

CREATE POLICY "Allow anonymous insert access to survey_invitations" 
ON public.survey_invitations 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to survey_invitations" 
ON public.survey_invitations 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow anonymous delete access to survey_invitations" 
ON public.survey_invitations 
FOR DELETE 
USING (true);

-- Create indexes for performance
CREATE INDEX idx_survey_invitations_campaign_id ON public.survey_invitations(campaign_id);
CREATE INDEX idx_survey_invitations_email ON public.survey_invitations(email);
CREATE INDEX idx_survey_invitations_token ON public.survey_invitations(unique_token);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_survey_invitations_updated_at
BEFORE UPDATE ON public.survey_invitations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();