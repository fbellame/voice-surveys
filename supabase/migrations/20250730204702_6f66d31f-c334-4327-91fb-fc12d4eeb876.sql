-- Add campaign_type to campaign table
ALTER TABLE public.campaign 
ADD COLUMN campaign_type TEXT NOT NULL DEFAULT 'web_survey'
CHECK (campaign_type IN ('web_survey', 'phone_survey'));