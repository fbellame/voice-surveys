-- Clean up duplicate survey responses and consolidate data
-- First, update the agent-created response with user data from UI response
UPDATE public.survey_response 
SET 
  user_id = duplicate.user_id,
  phone_number = duplicate.phone_number,
  invitation_token = duplicate.invitation_token
FROM (
  SELECT DISTINCT ON (invitation_token) 
    id,
    user_id,
    phone_number,
    invitation_token,
    campaign_id
  FROM public.survey_response 
  WHERE invitation_token IS NOT NULL 
    AND s3_recording_url IS NULL
) AS duplicate
WHERE public.survey_response.campaign_id = duplicate.campaign_id
  AND public.survey_response.s3_recording_url IS NOT NULL
  AND public.survey_response.invitation_token IS NULL;

-- Delete the UI-created duplicates that don't have recording URLs
DELETE FROM public.survey_response 
WHERE s3_recording_url IS NULL 
  AND invitation_token IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.survey_response sr2
    WHERE sr2.campaign_id = survey_response.campaign_id
      AND sr2.invitation_token = survey_response.invitation_token
      AND sr2.s3_recording_url IS NOT NULL
      AND sr2.id != survey_response.id
  );