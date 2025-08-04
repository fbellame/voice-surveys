-- Allow anonymous read access to survey invitations for token validation
CREATE POLICY "Allow anonymous read for invitation token validation" 
ON public.survey_invitations 
FOR SELECT 
USING (true);