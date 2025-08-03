-- Drop existing foreign key constraint
ALTER TABLE public.survey_response 
DROP CONSTRAINT IF EXISTS survey_response_invitation_token_fkey;

-- Add new foreign key constraint with SET NULL on delete
ALTER TABLE public.survey_response 
ADD CONSTRAINT survey_response_invitation_token_fkey 
FOREIGN KEY (invitation_token) 
REFERENCES public.survey_invitations(unique_token) 
ON DELETE SET NULL;