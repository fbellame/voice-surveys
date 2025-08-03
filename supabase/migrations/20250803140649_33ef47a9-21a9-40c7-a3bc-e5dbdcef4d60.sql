-- Update existing campaigns to have a campaign_uri based on their name if they don't have one
UPDATE public.campaign 
SET campaign_uri = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9\s]', '', 'g'), '\s+', '-', 'g'))
WHERE campaign_uri IS NULL OR campaign_uri = '';