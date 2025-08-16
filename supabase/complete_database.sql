-- Complete database schema with user_profiles table to fix race condition
-- Run this script to create the complete database structure

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

COMMENT ON SCHEMA "public" IS 'standard public schema';

-- Functions
CREATE OR REPLACE FUNCTION "public"."decrement_generic_link_responses"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF OLD.link_type = 'generic' THEN
        UPDATE public.campaign_links 
        SET current_responses = GREATEST(current_responses - 1, 0)
        WHERE unique_token = OLD.link_token;
    END IF;
    RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."increment_generic_link_responses"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.link_type = 'generic' THEN
        UPDATE public.campaign_links 
        SET current_responses = current_responses + 1
        WHERE unique_token = NEW.link_token;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

SET default_tablespace = '';
SET default_table_access_method = "heap";

-- Tables

-- Answer table
CREATE TABLE IF NOT EXISTS "public"."answer" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "survey_submission_id" "uuid" NOT NULL,
    "question_id" bigint NOT NULL,
    "answer_text" "text" NOT NULL,
    "answered_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

-- Campaign table
CREATE SEQUENCE IF NOT EXISTS "public"."campaign_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE IF NOT EXISTS "public"."campaign" (
    "id" bigint DEFAULT "nextval"('"public"."campaign_id_seq"'::"regclass") NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "start_date" "date",
    "end_date" "date",
    "intro_prompt" "text",
    "purpose_explanation" "text",
    "greeting" "text",
    "closing" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "campaign_type" "text" DEFAULT 'web_survey'::"text" NOT NULL,
    "campaign_uri" "text",
    "user_id" "uuid",
    CONSTRAINT "campaign_campaign_type_check" CHECK (("campaign_type" = ANY (ARRAY['web_survey'::"text", 'phone_survey'::"text"])))
);

-- Campaign links table
CREATE TABLE IF NOT EXISTS "public"."campaign_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" bigint NOT NULL,
    "link_type" "text" DEFAULT 'generic'::"text" NOT NULL,
    "unique_token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'base64'::"text") NOT NULL,
    "name" "text",
    "description" "text",
    "is_active" boolean DEFAULT true,
    "max_responses" integer,
    "current_responses" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    CONSTRAINT "campaign_links_link_type_check" CHECK (("link_type" = ANY (ARRAY['generic'::"text", 'personal'::"text"])))
);

-- Campaign room mapping table
CREATE SEQUENCE IF NOT EXISTS "public"."campaign_room_mapping_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE IF NOT EXISTS "public"."campaign_room_mapping" (
    "id" bigint DEFAULT "nextval"('"public"."campaign_room_mapping_id_seq"'::"regclass") NOT NULL,
    "campaign_id" bigint NOT NULL,
    "room_pattern" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

-- Question table
CREATE SEQUENCE IF NOT EXISTS "public"."question_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE IF NOT EXISTS "public"."question" (
    "id" bigint DEFAULT "nextval"('"public"."question_id_seq"'::"regclass") NOT NULL,
    "campaign_id" bigint NOT NULL,
    "question_text" "text" NOT NULL,
    "question_order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

-- Survey invitations table
CREATE TABLE IF NOT EXISTS "public"."survey_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" bigint NOT NULL,
    "invitation_type" "text" DEFAULT 'email'::"text" NOT NULL,
    "contact_value" "text" NOT NULL,
    "unique_token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'base64'::"text") NOT NULL,
    "qr_code_url" "text",
    "sent_at" timestamp with time zone,
    "responded_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    CONSTRAINT "survey_invitations_invitation_type_check" CHECK (("invitation_type" = ANY (ARRAY['email'::"text", 'phone'::"text", 'other'::"text"])))
);

-- NEW: User profiles table (separates user data from session data)
CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" bigint NOT NULL,
    "full_name" "text",
    "email" "text",
    "geography" "text",
    "occupation" "text",
    "phone_number" "text",
    "link_token" "text" NOT NULL,
    "link_type" "text" NOT NULL,
    "invitation_token" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

-- UPDATED: Survey submissions table (cleaned up, only session data)
CREATE TABLE IF NOT EXISTS "public"."survey_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" bigint NOT NULL,
    "user_profile_id" "uuid",  -- Links to user_profiles table
    "room_name" "text",
    "link_token" "text" NOT NULL,
    "link_type" "text" NOT NULL,
    "s3_recording_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "call_timestamp" timestamp with time zone DEFAULT "now"()
);

-- Primary key constraints
ALTER TABLE ONLY "public"."answer" ADD CONSTRAINT "answer_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."campaign_links" ADD CONSTRAINT "campaign_links_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."campaign_links" ADD CONSTRAINT "campaign_links_unique_token_key" UNIQUE ("unique_token");
ALTER TABLE ONLY "public"."campaign" ADD CONSTRAINT "campaign_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."campaign_room_mapping" ADD CONSTRAINT "campaign_room_mapping_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."campaign_room_mapping" ADD CONSTRAINT "campaign_room_mapping_room_pattern_key" UNIQUE ("room_pattern");
ALTER TABLE ONLY "public"."campaign" ADD CONSTRAINT "campaign_uri_unique" UNIQUE ("campaign_uri");
ALTER TABLE ONLY "public"."question" ADD CONSTRAINT "question_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."survey_invitations" ADD CONSTRAINT "survey_invitations_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."survey_invitations" ADD CONSTRAINT "survey_invitations_unique_token_key" UNIQUE ("unique_token");
ALTER TABLE ONLY "public"."user_profiles" ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."survey_submissions" ADD CONSTRAINT "survey_submissions_pkey" PRIMARY KEY ("id");

-- Indexes
CREATE INDEX "idx_campaign_id" ON "public"."question" USING "btree" ("campaign_id");
CREATE INDEX "idx_campaign_links_campaign_id" ON "public"."campaign_links" USING "btree" ("campaign_id");
CREATE INDEX "idx_campaign_links_token" ON "public"."campaign_links" USING "btree" ("unique_token");
CREATE INDEX "idx_campaign_room_mapping_campaign_id" ON "public"."campaign_room_mapping" USING "btree" ("campaign_id");
CREATE INDEX "idx_campaign_room_mapping_pattern" ON "public"."campaign_room_mapping" USING "btree" ("room_pattern");
CREATE INDEX "idx_campaign_uri" ON "public"."campaign" USING "btree" ("campaign_uri");
CREATE INDEX "idx_survey_invitations_campaign_id" ON "public"."survey_invitations" USING "btree" ("campaign_id");
CREATE INDEX "idx_survey_invitations_contact" ON "public"."survey_invitations" USING "btree" ("contact_value");
CREATE INDEX "idx_survey_invitations_token" ON "public"."survey_invitations" USING "btree" ("unique_token");

-- User profiles indexes
CREATE INDEX "idx_user_profiles_campaign_id" ON "public"."user_profiles" USING "btree" ("campaign_id");
CREATE INDEX "idx_user_profiles_link_token" ON "public"."user_profiles" USING "btree" ("link_token");
CREATE INDEX "idx_user_profiles_link_type" ON "public"."user_profiles" USING "btree" ("link_type");

-- Survey submissions indexes
CREATE INDEX "idx_survey_submissions_campaign_id" ON "public"."survey_submissions" USING "btree" ("campaign_id");
CREATE INDEX "idx_survey_submissions_user_profile_id" ON "public"."survey_submissions" USING "btree" ("user_profile_id");
CREATE INDEX "idx_survey_submissions_link_token" ON "public"."survey_submissions" USING "btree" ("link_token");
CREATE INDEX "idx_survey_submissions_link_type" ON "public"."survey_submissions" USING "btree" ("link_type");
CREATE UNIQUE INDEX "idx_survey_submissions_personal_unique" ON "public"."survey_submissions" USING "btree" ("link_token") WHERE ("link_type" = 'personal'::"text");

-- Triggers
CREATE OR REPLACE TRIGGER "decrement_generic_link_responses_trigger" AFTER DELETE ON "public"."survey_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."decrement_generic_link_responses"();
CREATE OR REPLACE TRIGGER "increment_generic_link_responses_trigger" AFTER INSERT ON "public"."survey_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."increment_generic_link_responses"();
CREATE OR REPLACE TRIGGER "update_answer_updated_at" BEFORE UPDATE ON "public"."answer" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
CREATE OR REPLACE TRIGGER "update_campaign_links_updated_at" BEFORE UPDATE ON "public"."campaign_links" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
CREATE OR REPLACE TRIGGER "update_campaign_room_mapping_updated_at" BEFORE UPDATE ON "public"."campaign_room_mapping" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
CREATE OR REPLACE TRIGGER "update_campaign_updated_at" BEFORE UPDATE ON "public"."campaign" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
CREATE OR REPLACE TRIGGER "update_question_updated_at" BEFORE UPDATE ON "public"."question" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
CREATE OR REPLACE TRIGGER "update_survey_invitations_updated_at" BEFORE UPDATE ON "public"."survey_invitations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
CREATE OR REPLACE TRIGGER "update_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
CREATE OR REPLACE TRIGGER "update_survey_submissions_updated_at" BEFORE UPDATE ON "public"."survey_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

-- Foreign key constraints
ALTER TABLE ONLY "public"."answer" ADD CONSTRAINT "answer_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."answer" ADD CONSTRAINT "answer_survey_submission_id_fkey" FOREIGN KEY ("survey_submission_id") REFERENCES "public"."survey_submissions"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."campaign_links" ADD CONSTRAINT "campaign_links_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."campaign_room_mapping" ADD CONSTRAINT "campaign_room_mapping_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."campaign" ADD CONSTRAINT "campaign_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."question" ADD CONSTRAINT "question_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."survey_invitations" ADD CONSTRAINT "survey_invitations_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."survey_invitations" ADD CONSTRAINT "survey_invitations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."user_profiles" ADD CONSTRAINT "user_profiles_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."survey_submissions" ADD CONSTRAINT "survey_submissions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."survey_submissions" ADD CONSTRAINT "survey_submissions_user_profile_id_fkey" FOREIGN KEY ("user_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;
