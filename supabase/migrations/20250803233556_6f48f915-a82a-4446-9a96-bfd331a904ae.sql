-- Add DELETE policy for survey_invitations table
CREATE POLICY "Users can delete their own invitations" 
ON public.survey_invitations 
FOR DELETE 
USING (auth.uid() = user_id);