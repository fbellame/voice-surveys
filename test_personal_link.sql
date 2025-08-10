-- Test script to verify personal link creation works
-- Run this in your local Supabase Studio SQL editor

-- Test 1: Create a personal invitation (this should work now)
INSERT INTO "public"."survey_invitations" (
    "campaign_id", 
    "invitation_type", 
    "contact_value", 
    "user_id"
) VALUES (
    1, 
    'email', 
    'test@example.com', 
    NULL
) RETURNING *;

-- Test 2: Verify the invitation was created with a unique_token
SELECT 
    id,
    campaign_id,
    invitation_type,
    contact_value,
    unique_token,
    created_at
FROM "public"."survey_invitations" 
WHERE contact_value = 'test@example.com';

-- Test 3: Create a survey submission using the personal link
INSERT INTO "public"."survey_submissions" (
    "campaign_id",
    "full_name",
    "email",
    "link_token",
    "link_type"
) VALUES (
    1,
    'Test User',
    'test@example.com',
    (SELECT unique_token FROM "public"."survey_invitations" WHERE contact_value = 'test@example.com' LIMIT 1),
    'personal'
) RETURNING *;

-- Test 4: Verify the submission was created
SELECT 
    id,
    campaign_id,
    full_name,
    link_token,
    link_type,
    created_at
FROM "public"."survey_submissions" 
WHERE link_type = 'personal';

-- Test 5: Try to create another submission with the same personal link (should fail due to unique constraint)
INSERT INTO "public"."survey_submissions" (
    "campaign_id",
    "full_name",
    "email",
    "link_token",
    "link_type"
) VALUES (
    1,
    'Another User',
    'another@example.com',
    (SELECT unique_token FROM "public"."survey_invitations" WHERE contact_value = 'test@example.com' LIMIT 1),
    'personal'
);
