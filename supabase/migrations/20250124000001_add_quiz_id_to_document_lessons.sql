-- Add quiz_id to document_lessons to link lessons to quizzes
-- This ensures lessons are generated based on quiz content

ALTER TABLE document_lessons
ADD COLUMN IF NOT EXISTS quiz_id UUID REFERENCES quizzes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_document_lessons_quiz_id ON document_lessons(quiz_id);

-- Update RLS policies to allow querying by quiz
-- (existing policies already cover document ownership)

