-- Migration: Add lesson system tables (separate from survey tables)
-- This migration creates a complete set of tables for lessons without modifying survey tables

-- Create all sequences FIRST (before tables that use them)
CREATE SEQUENCE IF NOT EXISTS "public"."lesson_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS "public"."lesson_question_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS "public"."lesson_room_mapping_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Set sequence owners
ALTER SEQUENCE "public"."lesson_id_seq" OWNER TO "postgres";
ALTER SEQUENCE "public"."lesson_question_id_seq" OWNER TO "postgres";
ALTER SEQUENCE "public"."lesson_room_mapping_id_seq" OWNER TO "postgres";

-- Create update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

-- Create lesson table (separate from campaign table)
CREATE TABLE IF NOT EXISTS "public"."lesson" (
    "id" bigint DEFAULT nextval('"public"."lesson_id_seq"'::regclass) NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "start_date" date,
    "end_date" date,
    "intro_prompt" text,
    "purpose_explanation" text,
    "greeting" text,
    "closing" text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "lesson_uri" text,
    "user_id" uuid,
    "document_url" text,
    "document_text" text, -- Extracted text from PDF
    CONSTRAINT "lesson_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."lesson" OWNER TO "postgres";

-- Create unique constraint on lesson_uri
CREATE UNIQUE INDEX IF NOT EXISTS "lesson_uri_unique" ON "public"."lesson"("lesson_uri");

-- Create student_profiles table FIRST (before tables that reference it)
CREATE TABLE IF NOT EXISTS "public"."student_profiles" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid, -- Link to auth.users if authenticated
    "full_name" text,
    "email" text,
    "phone_number" text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."student_profiles" OWNER TO "postgres";

-- Create unique constraint on email
CREATE UNIQUE INDEX IF NOT EXISTS "student_profiles_email_unique" 
ON "public"."student_profiles"("email") 
WHERE "email" IS NOT NULL;

-- Create lesson_question table (separate from question table)
CREATE TABLE IF NOT EXISTS "public"."lesson_question" (
    "id" bigint DEFAULT nextval('"public"."lesson_question_id_seq"'::regclass) NOT NULL,
    "lesson_id" bigint NOT NULL,
    "question_text" text NOT NULL,
    "question_order" integer NOT NULL,
    "is_quiz_question" boolean DEFAULT false,
    "correct_answer" text,
    "points" integer DEFAULT 1,
    "explanation" text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "lesson_question_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."lesson_question" OWNER TO "postgres";

-- Add foreign key constraint
ALTER TABLE "public"."lesson_question"
ADD CONSTRAINT "lesson_question_lesson_id_fkey" 
FOREIGN KEY ("lesson_id") 
REFERENCES "public"."lesson"("id") 
ON DELETE CASCADE;

-- Create index for lesson_question
CREATE INDEX IF NOT EXISTS "idx_lesson_question_lesson_id" 
ON "public"."lesson_question"("lesson_id");

-- Create lesson_links table (similar to campaign_links but for lessons)
CREATE TABLE IF NOT EXISTS "public"."lesson_links" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "lesson_id" bigint NOT NULL,
    "link_type" text DEFAULT 'generic'::text NOT NULL,
    "unique_token" text DEFAULT encode(extensions.gen_random_bytes(32), 'base64'::text) NOT NULL,
    "name" text,
    "description" text,
    "is_active" boolean DEFAULT true,
    "max_responses" integer,
    "current_responses" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "user_id" uuid,
    "is_anonymous" boolean DEFAULT false,
    CONSTRAINT "lesson_links_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lesson_links_link_type_check" CHECK (("link_type" = ANY (ARRAY['generic'::text, 'personal'::text])))
);

ALTER TABLE "public"."lesson_links" OWNER TO "postgres";

-- Add foreign key constraint
ALTER TABLE "public"."lesson_links"
ADD CONSTRAINT "lesson_links_lesson_id_fkey" 
FOREIGN KEY ("lesson_id") 
REFERENCES "public"."lesson"("id") 
ON DELETE CASCADE;

-- Create unique constraint on unique_token
CREATE UNIQUE INDEX IF NOT EXISTS "lesson_links_unique_token_key" 
ON "public"."lesson_links"("unique_token");

-- Create index for lesson_links
CREATE INDEX IF NOT EXISTS "idx_lesson_links_lesson_id" 
ON "public"."lesson_links"("lesson_id");

-- Create lesson_room_mapping table (similar to campaign_room_mapping)
CREATE TABLE IF NOT EXISTS "public"."lesson_room_mapping" (
    "id" bigint DEFAULT nextval('"public"."lesson_room_mapping_id_seq"'::regclass) NOT NULL,
    "lesson_id" bigint NOT NULL,
    "room_pattern" text NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "lesson_room_mapping_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lesson_room_mapping_room_pattern_key" UNIQUE ("room_pattern")
);

ALTER TABLE "public"."lesson_room_mapping" OWNER TO "postgres";

-- Add foreign key constraint
ALTER TABLE "public"."lesson_room_mapping"
ADD CONSTRAINT "lesson_room_mapping_lesson_id_fkey" 
FOREIGN KEY ("lesson_id") 
REFERENCES "public"."lesson"("id") 
ON DELETE CASCADE;

-- Create lesson_submissions table (separate from survey_submissions)
CREATE TABLE IF NOT EXISTS "public"."lesson_submissions" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "lesson_id" bigint NOT NULL,
    "student_profile_id" uuid,
    "room_name" text,
    "link_token" text NOT NULL,
    "link_type" text NOT NULL,
    "s3_recording_url" text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "call_timestamp" timestamp with time zone DEFAULT now(),
    CONSTRAINT "lesson_submissions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."lesson_submissions" OWNER TO "postgres";

-- Add foreign key constraints
ALTER TABLE "public"."lesson_submissions"
ADD CONSTRAINT "lesson_submissions_lesson_id_fkey" 
FOREIGN KEY ("lesson_id") 
REFERENCES "public"."lesson"("id") 
ON DELETE CASCADE;

ALTER TABLE "public"."lesson_submissions"
ADD CONSTRAINT "lesson_submissions_student_profile_id_fkey" 
FOREIGN KEY ("student_profile_id") 
REFERENCES "public"."student_profiles"("id") 
ON DELETE SET NULL;

-- Create lesson_answer table (separate from answer table)
CREATE TABLE IF NOT EXISTS "public"."lesson_answer" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "lesson_submission_id" uuid NOT NULL,
    "lesson_question_id" bigint NOT NULL,
    "answer_text" text NOT NULL,
    "is_correct" boolean,
    "points_earned" integer DEFAULT 0,
    "feedback" text,
    "response_time_seconds" numeric,
    "answered_at" timestamp with time zone DEFAULT now(),
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "lesson_answer_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."lesson_answer" OWNER TO "postgres";

-- Add foreign key constraints
ALTER TABLE "public"."lesson_answer"
ADD CONSTRAINT "lesson_answer_lesson_submission_id_fkey" 
FOREIGN KEY ("lesson_submission_id") 
REFERENCES "public"."lesson_submissions"("id") 
ON DELETE CASCADE;

ALTER TABLE "public"."lesson_answer"
ADD CONSTRAINT "lesson_answer_lesson_question_id_fkey" 
FOREIGN KEY ("lesson_question_id") 
REFERENCES "public"."lesson_question"("id") 
ON DELETE CASCADE;

-- Create indexes for lesson_answer
CREATE INDEX IF NOT EXISTS "idx_lesson_answer_submission_id" 
ON "public"."lesson_answer"("lesson_submission_id");

CREATE INDEX IF NOT EXISTS "idx_lesson_answer_question_id" 
ON "public"."lesson_answer"("lesson_question_id");

-- Create lesson_invitations table (similar to survey_invitations)
CREATE TABLE IF NOT EXISTS "public"."lesson_invitations" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "lesson_id" bigint NOT NULL,
    "invitation_type" text DEFAULT 'email'::text NOT NULL,
    "contact_value" text NOT NULL,
    "unique_token" text DEFAULT encode(extensions.gen_random_bytes(32), 'base64'::text) NOT NULL,
    "qr_code_url" text,
    "sent_at" timestamp with time zone,
    "responded_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "user_id" uuid,
    CONSTRAINT "lesson_invitations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lesson_invitations_invitation_type_check" CHECK (("invitation_type" = ANY (ARRAY['email'::text, 'phone'::text, 'other'::text])))
);

ALTER TABLE "public"."lesson_invitations" OWNER TO "postgres";

-- Add foreign key constraint
ALTER TABLE "public"."lesson_invitations"
ADD CONSTRAINT "lesson_invitations_lesson_id_fkey" 
FOREIGN KEY ("lesson_id") 
REFERENCES "public"."lesson"("id") 
ON DELETE CASCADE;

-- Create unique constraint on unique_token
CREATE UNIQUE INDEX IF NOT EXISTS "lesson_invitations_unique_token_key" 
ON "public"."lesson_invitations"("unique_token");

-- Create lesson_documents table for storing PDF documents
CREATE TABLE IF NOT EXISTS "public"."lesson_documents" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "lesson_id" bigint NOT NULL,
    "file_name" text NOT NULL,
    "file_url" text NOT NULL,
    "file_size" bigint,
    "mime_type" text DEFAULT 'application/pdf'::text,
    "extracted_text" text, -- Full text extracted from PDF
    "uploaded_by" uuid,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "lesson_documents_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."lesson_documents" OWNER TO "postgres";

-- Add foreign key constraint
ALTER TABLE "public"."lesson_documents"
ADD CONSTRAINT "lesson_documents_lesson_id_fkey" 
FOREIGN KEY ("lesson_id") 
REFERENCES "public"."lesson"("id") 
ON DELETE CASCADE;

-- Create lesson_performance table for tracking overall lesson performance
CREATE TABLE IF NOT EXISTS "public"."lesson_performance" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "lesson_submission_id" uuid NOT NULL,
    "student_profile_id" uuid,
    "lesson_id" bigint NOT NULL,
    "total_questions" integer DEFAULT 0,
    "correct_answers" integer DEFAULT 0,
    "total_points" integer DEFAULT 0,
    "points_earned" integer DEFAULT 0,
    "score_percentage" numeric(5, 2), -- 0.00 to 100.00
    "completion_time_seconds" integer,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "lesson_performance_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."lesson_performance" OWNER TO "postgres";

-- Add foreign key constraints
ALTER TABLE "public"."lesson_performance"
ADD CONSTRAINT "lesson_performance_lesson_submission_id_fkey" 
FOREIGN KEY ("lesson_submission_id") 
REFERENCES "public"."lesson_submissions"("id") 
ON DELETE CASCADE;

ALTER TABLE "public"."lesson_performance"
ADD CONSTRAINT "lesson_performance_lesson_id_fkey" 
FOREIGN KEY ("lesson_id") 
REFERENCES "public"."lesson"("id") 
ON DELETE CASCADE;

ALTER TABLE "public"."lesson_performance"
ADD CONSTRAINT "lesson_performance_student_profile_id_fkey" 
FOREIGN KEY ("student_profile_id") 
REFERENCES "public"."student_profiles"("id") 
ON DELETE SET NULL;

-- Create indexes for performance queries
CREATE INDEX IF NOT EXISTS "idx_lesson_performance_lesson_id" 
ON "public"."lesson_performance"("lesson_id");

CREATE INDEX IF NOT EXISTS "idx_lesson_performance_student_profile_id" 
ON "public"."lesson_performance"("student_profile_id");

CREATE INDEX IF NOT EXISTS "idx_lesson_performance_submission_id" 
ON "public"."lesson_performance"("lesson_submission_id");

-- Add triggers to update updated_at columns
-- Drop triggers if they exist (for idempotency), then create them
DROP TRIGGER IF EXISTS "update_lesson_updated_at" ON "public"."lesson";
CREATE TRIGGER "update_lesson_updated_at"
    BEFORE UPDATE ON "public"."lesson"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();

DROP TRIGGER IF EXISTS "update_lesson_question_updated_at" ON "public"."lesson_question";
CREATE TRIGGER "update_lesson_question_updated_at"
    BEFORE UPDATE ON "public"."lesson_question"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();

DROP TRIGGER IF EXISTS "update_lesson_links_updated_at" ON "public"."lesson_links";
CREATE TRIGGER "update_lesson_links_updated_at"
    BEFORE UPDATE ON "public"."lesson_links"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();

DROP TRIGGER IF EXISTS "update_lesson_room_mapping_updated_at" ON "public"."lesson_room_mapping";
CREATE TRIGGER "update_lesson_room_mapping_updated_at"
    BEFORE UPDATE ON "public"."lesson_room_mapping"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();

DROP TRIGGER IF EXISTS "update_lesson_submissions_updated_at" ON "public"."lesson_submissions";
CREATE TRIGGER "update_lesson_submissions_updated_at"
    BEFORE UPDATE ON "public"."lesson_submissions"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();

DROP TRIGGER IF EXISTS "update_lesson_answer_updated_at" ON "public"."lesson_answer";
CREATE TRIGGER "update_lesson_answer_updated_at"
    BEFORE UPDATE ON "public"."lesson_answer"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();

DROP TRIGGER IF EXISTS "update_lesson_invitations_updated_at" ON "public"."lesson_invitations";
CREATE TRIGGER "update_lesson_invitations_updated_at"
    BEFORE UPDATE ON "public"."lesson_invitations"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();

DROP TRIGGER IF EXISTS "update_lesson_documents_updated_at" ON "public"."lesson_documents";
CREATE TRIGGER "update_lesson_documents_updated_at"
    BEFORE UPDATE ON "public"."lesson_documents"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();

DROP TRIGGER IF EXISTS "update_student_profiles_updated_at" ON "public"."student_profiles";
CREATE TRIGGER "update_student_profiles_updated_at"
    BEFORE UPDATE ON "public"."student_profiles"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();

DROP TRIGGER IF EXISTS "update_lesson_performance_updated_at" ON "public"."lesson_performance";
CREATE TRIGGER "update_lesson_performance_updated_at"
    BEFORE UPDATE ON "public"."lesson_performance"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_updated_at_column"();

-- Add comments for documentation
COMMENT ON TABLE "public"."lesson" IS 'Lessons created by teachers (separate from surveys/campaigns)';
COMMENT ON TABLE "public"."lesson_question" IS 'Questions for lessons, can be quiz questions with correct answers';
COMMENT ON TABLE "public"."lesson_links" IS 'Shareable links for lessons';
COMMENT ON TABLE "public"."lesson_room_mapping" IS 'Maps room patterns to lessons for LiveKit';
COMMENT ON TABLE "public"."lesson_submissions" IS 'Student submissions/attempts for lessons';
COMMENT ON TABLE "public"."lesson_answer" IS 'Answers to lesson questions with correctness and scoring';
COMMENT ON TABLE "public"."lesson_invitations" IS 'Personal invitations for lessons';
COMMENT ON TABLE "public"."lesson_documents" IS 'PDF documents uploaded for lessons';
COMMENT ON TABLE "public"."student_profiles" IS 'Student profiles for lesson tracking';
COMMENT ON TABLE "public"."lesson_performance" IS 'Tracks student performance on lessons/quizzes';
COMMENT ON COLUMN "public"."lesson_question"."is_quiz_question" IS 'Whether this question is part of a quiz with correct answers';
COMMENT ON COLUMN "public"."lesson_answer"."is_correct" IS 'Whether the answer is correct (for quiz questions)';

