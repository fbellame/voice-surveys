-- Migration: Create document lessons system
-- This allows users to create structured lessons from document chunks to learn before taking quizzes

-- Create document_lessons table
CREATE TABLE IF NOT EXISTS document_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  overview TEXT, -- High-level overview of the lesson
  estimated_duration_minutes INTEGER DEFAULT 15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create lesson_parts table (multiple parts/sections of a lesson)
CREATE TABLE IF NOT EXISTS lesson_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES document_lessons(id) ON DELETE CASCADE,
  part_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL, -- The main content/explanation for this part
  summary TEXT, -- Brief summary of key points
  learning_objectives JSONB, -- Array of learning objectives for this part
  key_concepts JSONB, -- Array of key concepts covered
  examples JSONB, -- Array of examples or illustrations
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_lesson_part_number UNIQUE (lesson_id, part_number)
);

-- Create lesson_part_chunks table (links lesson parts to source document chunks)
CREATE TABLE IF NOT EXISTS lesson_part_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_part_id UUID NOT NULL REFERENCES lesson_parts(id) ON DELETE CASCADE,
  chunk_id UUID NOT NULL REFERENCES doc_chunks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_lesson_part_chunk UNIQUE (lesson_part_id, chunk_id)
);

-- Create lesson_progress table (tracks user progress through lessons)
CREATE TABLE IF NOT EXISTS lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES document_lessons(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  current_part_number INTEGER DEFAULT 1,
  completed_parts JSONB DEFAULT '[]'::jsonb, -- Array of completed part numbers
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_document_lessons_document_id ON document_lessons(document_id);
CREATE INDEX IF NOT EXISTS idx_lesson_parts_lesson_id ON lesson_parts(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_parts_part_number ON lesson_parts(lesson_id, part_number);
CREATE INDEX IF NOT EXISTS idx_lesson_part_chunks_lesson_part_id ON lesson_part_chunks(lesson_part_id);
CREATE INDEX IF NOT EXISTS idx_lesson_part_chunks_chunk_id ON lesson_part_chunks(chunk_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson_id ON lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_id ON lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_lesson ON lesson_progress(user_id, lesson_id);

-- Enable RLS
ALTER TABLE document_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_part_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies for document_lessons
CREATE POLICY "Users can view lessons of their documents"
  ON document_lessons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_lessons.document_id
      AND documents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert lessons for their documents"
  ON document_lessons FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_lessons.document_id
      AND documents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update lessons of their documents"
  ON document_lessons FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_lessons.document_id
      AND documents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete lessons of their documents"
  ON document_lessons FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_lessons.document_id
      AND documents.user_id = auth.uid()
    )
  );

-- RLS Policies for lesson_parts
CREATE POLICY "Users can view parts of their lessons"
  ON lesson_parts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM document_lessons
      JOIN documents ON documents.id = document_lessons.document_id
      WHERE document_lessons.id = lesson_parts.lesson_id
      AND documents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert parts for their lessons"
  ON lesson_parts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM document_lessons
      JOIN documents ON documents.id = document_lessons.document_id
      WHERE document_lessons.id = lesson_parts.lesson_id
      AND documents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update parts of their lessons"
  ON lesson_parts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM document_lessons
      JOIN documents ON documents.id = document_lessons.document_id
      WHERE document_lessons.id = lesson_parts.lesson_id
      AND documents.user_id = auth.uid()
    )
  );

-- RLS Policies for lesson_part_chunks
CREATE POLICY "Users can view chunk links of their lesson parts"
  ON lesson_part_chunks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lesson_parts
      JOIN document_lessons ON document_lessons.id = lesson_parts.lesson_id
      JOIN documents ON documents.id = document_lessons.document_id
      WHERE lesson_parts.id = lesson_part_chunks.lesson_part_id
      AND documents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert chunk links for their lesson parts"
  ON lesson_part_chunks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lesson_parts
      JOIN document_lessons ON document_lessons.id = lesson_parts.lesson_id
      JOIN documents ON documents.id = document_lessons.document_id
      WHERE lesson_parts.id = lesson_part_chunks.lesson_part_id
      AND documents.user_id = auth.uid()
    )
  );

-- RLS Policies for lesson_progress
CREATE POLICY "Users can view their own lesson progress"
  ON lesson_progress FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert their own lesson progress"
  ON lesson_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update their own lesson progress"
  ON lesson_progress FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_lesson_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_document_lessons_updated_at
  BEFORE UPDATE ON document_lessons
  FOR EACH ROW
  EXECUTE FUNCTION update_lesson_updated_at();

CREATE TRIGGER update_lesson_parts_updated_at
  BEFORE UPDATE ON lesson_parts
  FOR EACH ROW
  EXECUTE FUNCTION update_lesson_updated_at();

CREATE TRIGGER update_lesson_progress_updated_at
  BEFORE UPDATE ON lesson_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_lesson_updated_at();

-- Trigger to update last_accessed_at on lesson_progress
CREATE OR REPLACE FUNCTION update_lesson_progress_last_accessed()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_accessed_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_lesson_progress_last_accessed
  BEFORE UPDATE ON lesson_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_lesson_progress_last_accessed();

