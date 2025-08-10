-- Seed data for testing personal link creation
-- This creates sample campaigns and users for testing

-- Insert a sample campaign
INSERT INTO "public"."campaign" ("id", "name", "description", "campaign_type", "user_id") 
VALUES (1, 'Test Campaign', 'A test campaign for development', 'web_survey', NULL)
ON CONFLICT (id) DO NOTHING;

-- Insert a sample campaign link
INSERT INTO "public"."campaign_links" ("id", "campaign_id", "link_type", "unique_token", "name", "description", "is_active", "user_id")
VALUES (
    gen_random_uuid(),
    1,
    'generic',
    encode(extensions.gen_random_bytes(32), 'base64'),
    'Test Generic Link',
    'A test generic link for development',
    true,
    NULL
) ON CONFLICT DO NOTHING;
