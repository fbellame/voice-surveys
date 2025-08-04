-- Clean up duplicate survey submissions and fix the linkage
-- First, let's identify and merge the duplicate records

-- Get the submission with S3 URL but no user details
-- Get the submission with user details but no S3 URL
-- Merge them into the one with S3 URL and delete the duplicate

-- Update the record with S3 URL to include the user details from the other record
UPDATE survey_submissions 
SET 
  full_name = s2.full_name,
  email = s2.email,
  geography = s2.geography,
  occupation = s2.occupation,
  phone_number = s2.phone_number,
  invitation_token = s2.invitation_token,
  updated_at = now()
FROM survey_submissions s2
WHERE survey_submissions.room_name = s2.room_name
  AND survey_submissions.s3_recording_url IS NOT NULL
  AND s2.s3_recording_url IS NULL
  AND s2.full_name IS NOT NULL;

-- Delete the duplicate records (ones without S3 URL that have been merged)
DELETE FROM survey_submissions 
WHERE s3_recording_url IS NULL 
  AND full_name IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM survey_submissions s2 
    WHERE s2.room_name = survey_submissions.room_name 
    AND s2.s3_recording_url IS NOT NULL
  );

-- Update any answers that might be linked to the deleted submission IDs
-- Since we're keeping the submission with S3 URL, we need to update answer references
UPDATE answer 
SET survey_submission_id = (
  SELECT id FROM survey_submissions 
  WHERE room_name = (
    SELECT room_name FROM survey_submissions s2 
    WHERE s2.id = answer.survey_submission_id
  )
  AND s3_recording_url IS NOT NULL
  LIMIT 1
)
WHERE survey_submission_id IN (
  SELECT id FROM survey_submissions 
  WHERE s3_recording_url IS NULL AND full_name IS NOT NULL
);