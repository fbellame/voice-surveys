-- Fix the encoding issue in survey_invitations table
ALTER TABLE public.survey_invitations 
ALTER COLUMN unique_token SET DEFAULT encode(extensions.gen_random_bytes(32), 'base64');