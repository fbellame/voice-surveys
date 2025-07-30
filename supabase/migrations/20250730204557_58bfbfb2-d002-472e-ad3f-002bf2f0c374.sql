-- Add campaign_type to campaign table
ALTER TABLE public.campaign 
ADD COLUMN campaign_type TEXT NOT NULL DEFAULT 'web_survey'
CHECK (campaign_type IN ('web_survey', 'phone_survey'));

-- Update RLS policies to allow UPDATE on campaign_room_mapping
CREATE POLICY "Allow anonymous update access to campaign_room_mapping" 
ON public.campaign_room_mapping 
FOR UPDATE 
USING (true);