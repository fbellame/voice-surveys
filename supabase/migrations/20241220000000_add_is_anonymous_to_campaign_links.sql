-- Add is_anonymous field to campaign_links table
ALTER TABLE public.campaign_links 
ADD COLUMN is_anonymous boolean DEFAULT false NOT NULL;

-- Add comment to document the field
COMMENT ON COLUMN public.campaign_links.is_anonymous IS 'Whether this link allows anonymous survey participation without user profiles';
