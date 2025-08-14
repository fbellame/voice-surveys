-- Add is_anonymous field to campaign_links table
ALTER TABLE public.campaign_links 
ADD COLUMN is_anonymous boolean DEFAULT false;

-- Add comment to explain the field
COMMENT ON COLUMN public.campaign_links.is_anonymous IS 'When true, allows anonymous survey submissions without creating user profiles';

-- Update the existing generic links to be non-anonymous by default
UPDATE public.campaign_links 
SET is_anonymous = false 
WHERE link_type = 'generic';
