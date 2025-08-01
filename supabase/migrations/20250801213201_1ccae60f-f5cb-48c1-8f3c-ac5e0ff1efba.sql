-- Add campaign_uri column to campaign table
ALTER TABLE public.campaign 
ADD COLUMN campaign_uri TEXT;

-- Update existing campaigns with appropriate URIs
UPDATE public.campaign 
SET campaign_uri = 'go-logic-cs-2025' 
WHERE name = 'go-logic-cs-2025';

UPDATE public.campaign 
SET campaign_uri = 'innovet-amr-2024' 
WHERE name = 'InnoVet-AMR 2024';

-- Add unique constraint to ensure no duplicate URIs
ALTER TABLE public.campaign 
ADD CONSTRAINT campaign_uri_unique UNIQUE (campaign_uri);

-- Add index for better performance
CREATE INDEX idx_campaign_uri ON public.campaign(campaign_uri);