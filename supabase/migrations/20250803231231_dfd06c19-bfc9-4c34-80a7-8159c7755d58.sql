-- Add missing INSERT policy for survey_invitations
CREATE POLICY "Users can create survey invitations" 
ON public.survey_invitations 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);