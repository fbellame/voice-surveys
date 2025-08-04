-- Fix infinite recursion in survey_response RLS policies
-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Users can view agent records in their rooms" ON public.survey_response;
DROP POLICY IF EXISTS "Users can update agent records in their rooms" ON public.survey_response;

-- Create simpler, non-recursive policies
CREATE POLICY "Users can view survey responses for their campaigns" 
ON public.survey_response 
FOR SELECT 
USING (
  campaign_id IN (
    SELECT id FROM public.campaign WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update survey responses for their campaigns" 
ON public.survey_response 
FOR UPDATE 
USING (
  campaign_id IN (
    SELECT id FROM public.campaign WHERE user_id = auth.uid()
  )
);