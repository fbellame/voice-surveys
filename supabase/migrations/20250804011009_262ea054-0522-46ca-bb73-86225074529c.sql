-- Fix RLS policies to allow users to view agent-created records in their campaign rooms
DROP POLICY IF EXISTS "Users can view survey responses by invitation token" ON public.survey_response;
DROP POLICY IF EXISTS "Users can update survey responses by invitation token" ON public.survey_response;

-- Allow users to view agent-created records (null user_id, null invitation_token) in same room/campaign as their invitation
CREATE POLICY "Users can view agent records in their rooms" 
ON public.survey_response 
FOR SELECT 
USING (
  user_id IS NULL 
  AND invitation_token IS NULL
  AND room_name IN (
    SELECT DISTINCT sr.room_name
    FROM public.survey_response sr
    JOIN public.survey_invitations si ON sr.invitation_token = si.unique_token
    WHERE si.user_id = auth.uid() AND sr.campaign_id = survey_response.campaign_id
  )
);

-- Allow users to update agent-created records in their rooms
CREATE POLICY "Users can update agent records in their rooms" 
ON public.survey_response 
FOR UPDATE 
USING (
  user_id IS NULL 
  AND invitation_token IS NULL
  AND room_name IN (
    SELECT DISTINCT sr.room_name
    FROM public.survey_response sr
    JOIN public.survey_invitations si ON sr.invitation_token = si.unique_token
    WHERE si.user_id = auth.uid() AND sr.campaign_id = survey_response.campaign_id
  )
);