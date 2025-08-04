-- Add RLS policies to allow users to view and update agent-created survey responses using invitation token
CREATE POLICY "Users can view survey responses by invitation token" 
ON public.survey_response 
FOR SELECT 
USING (
  user_id IS NULL 
  AND invitation_token IN (
    SELECT unique_token 
    FROM public.survey_invitations 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update survey responses by invitation token" 
ON public.survey_response 
FOR UPDATE 
USING (
  user_id IS NULL 
  AND invitation_token IN (
    SELECT unique_token 
    FROM public.survey_invitations 
    WHERE user_id = auth.uid()
  )
);