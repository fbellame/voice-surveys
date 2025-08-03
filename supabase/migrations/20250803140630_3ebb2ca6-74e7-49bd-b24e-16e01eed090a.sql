-- Add campaign_uri column to campaign table
ALTER TABLE public.campaign ADD COLUMN campaign_uri TEXT;

-- Update existing campaigns to have a campaign_uri based on their name
UPDATE public.campaign 
SET campaign_uri = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9\s]', '', 'g'))
WHERE campaign_uri IS NULL;

UPDATE public.campaign 
SET campaign_uri = REGEXP_REPLACE(campaign_uri, '\s+', '-', 'g')
WHERE campaign_uri IS NOT NULL;

-- Add unique constraint on campaign_uri
ALTER TABLE public.campaign ADD CONSTRAINT campaign_uri_unique UNIQUE (campaign_uri);