-- Migration: Add quiz-lesson-community integration tables
-- This migration creates tables for:
-- 1. Linking quizzes to lessons
-- 2. Community/class management
-- 3. Quiz distribution (assignments and anonymous links)

-- ============================================================================
-- 1. LESSON-QUIZ LINKING
-- ============================================================================

-- Create lesson_quizzes junction table
CREATE TABLE IF NOT EXISTS lesson_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id BIGINT NOT NULL REFERENCES lesson(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(lesson_id, quiz_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_quizzes_lesson_id ON lesson_quizzes(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_quizzes_quiz_id ON lesson_quizzes(quiz_id);

-- ============================================================================
-- 2. COMMUNITY/CLASS SYSTEM
-- ============================================================================

-- Create communities table
CREATE TABLE IF NOT EXISTS communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_communities_teacher_id ON communities(teacher_id);

-- Create community_members table
CREATE TABLE IF NOT EXISTS community_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  member_type TEXT NOT NULL CHECK (member_type IN ('user', 'student_profile')),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  student_profile_id UUID REFERENCES student_profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'student' CHECK (role IN ('student', 'assistant', 'teacher')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Ensure exactly one of user_id or student_profile_id is set
  CONSTRAINT community_members_member_check CHECK (
    (member_type = 'user' AND user_id IS NOT NULL AND student_profile_id IS NULL) OR
    (member_type = 'student_profile' AND student_profile_id IS NOT NULL AND user_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_community_members_community_id ON community_members(community_id);
CREATE INDEX IF NOT EXISTS idx_community_members_user_id ON community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_community_members_student_profile_id ON community_members(student_profile_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_community_members_unique_user ON community_members(community_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_community_members_unique_student ON community_members(community_id, student_profile_id) WHERE student_profile_id IS NOT NULL;

-- ============================================================================
-- 3. QUIZ DISTRIBUTION SYSTEM
-- ============================================================================

-- Create quiz_assignments table
CREATE TABLE IF NOT EXISTS quiz_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('user', 'student_profile', 'community')),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  student_profile_id UUID REFERENCES student_profiles(id) ON DELETE CASCADE,
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  due_date TIMESTAMPTZ,
  instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Ensure exactly one target is set based on assignment_type
  CONSTRAINT quiz_assignments_target_check CHECK (
    (assignment_type = 'user' AND user_id IS NOT NULL AND student_profile_id IS NULL AND community_id IS NULL) OR
    (assignment_type = 'student_profile' AND student_profile_id IS NOT NULL AND user_id IS NULL AND community_id IS NULL) OR
    (assignment_type = 'community' AND community_id IS NOT NULL AND user_id IS NULL AND student_profile_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_quiz_assignments_quiz_id ON quiz_assignments(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_assignments_assigned_by ON quiz_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_quiz_assignments_user_id ON quiz_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_assignments_student_profile_id ON quiz_assignments(student_profile_id);
CREATE INDEX IF NOT EXISTS idx_quiz_assignments_community_id ON quiz_assignments(community_id);

-- Create quiz_links table for anonymous sharing
CREATE TABLE IF NOT EXISTS quiz_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  unique_token TEXT NOT NULL UNIQUE,
  name TEXT,
  is_active BOOLEAN DEFAULT true,
  max_attempts INTEGER,
  expires_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_links_quiz_id ON quiz_links(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_links_unique_token ON quiz_links(unique_token);
CREATE INDEX IF NOT EXISTS idx_quiz_links_created_by ON quiz_links(created_by);

-- ============================================================================
-- 4. UPDATE ATTEMPTS TABLE
-- ============================================================================

-- Add new fields to attempts table
ALTER TABLE attempts 
  ADD COLUMN IF NOT EXISTS assignment_id UUID REFERENCES quiz_assignments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS link_token TEXT,
  ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false;

-- Allow NULL user_id for anonymous attempts
-- First, drop the foreign key constraint if it exists, then recreate it to allow NULL
ALTER TABLE attempts 
  DROP CONSTRAINT IF EXISTS attempts_user_id_fkey;

ALTER TABLE attempts 
  ALTER COLUMN user_id DROP NOT NULL;

-- Recreate foreign key constraint that allows NULL
ALTER TABLE attempts 
  ADD CONSTRAINT attempts_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_attempts_assignment_id ON attempts(assignment_id);
CREATE INDEX IF NOT EXISTS idx_attempts_link_token ON attempts(link_token);

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE lesson_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lesson_quizzes
CREATE POLICY "Users can view lesson_quizzes for their lessons"
  ON lesson_quizzes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lesson
      WHERE lesson.id = lesson_quizzes.lesson_id
      AND lesson.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert lesson_quizzes for their lessons"
  ON lesson_quizzes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lesson
      WHERE lesson.id = lesson_quizzes.lesson_id
      AND lesson.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM quizzes
      JOIN documents ON documents.id = quizzes.document_id
      WHERE quizzes.id = lesson_quizzes.quiz_id
      AND documents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete lesson_quizzes for their lessons"
  ON lesson_quizzes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM lesson
      WHERE lesson.id = lesson_quizzes.lesson_id
      AND lesson.user_id = auth.uid()
    )
  );

-- RLS Policies for communities
CREATE POLICY "Teachers can view their own communities"
  ON communities FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can create their own communities"
  ON communities FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update their own communities"
  ON communities FOR UPDATE
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete their own communities"
  ON communities FOR DELETE
  USING (teacher_id = auth.uid());

-- RLS Policies for community_members
CREATE POLICY "Teachers can view members of their communities"
  ON community_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM communities
      WHERE communities.id = community_members.community_id
      AND communities.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Members can view their own community memberships"
  ON community_members FOR SELECT
  USING (
    (member_type = 'user' AND user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM communities
      WHERE communities.id = community_members.community_id
      AND communities.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can insert members into their communities"
  ON community_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM communities
      WHERE communities.id = community_members.community_id
      AND communities.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can delete members from their communities"
  ON community_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM communities
      WHERE communities.id = community_members.community_id
      AND communities.teacher_id = auth.uid()
    )
  );

-- RLS Policies for quiz_assignments
CREATE POLICY "Teachers can view assignments for their quizzes"
  ON quiz_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
      JOIN documents ON documents.id = quizzes.document_id
      WHERE quizzes.id = quiz_assignments.quiz_id
      AND documents.user_id = auth.uid()
    )
  );

CREATE POLICY "Assigned users can view their assignments"
  ON quiz_assignments FOR SELECT
  USING (
    (assignment_type = 'user' AND user_id = auth.uid()) OR
    (assignment_type = 'community' AND EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = quiz_assignments.community_id
      AND community_members.user_id = auth.uid()
    ))
  );

CREATE POLICY "Teachers can create assignments for their quizzes"
  ON quiz_assignments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quizzes
      JOIN documents ON documents.id = quizzes.document_id
      WHERE quizzes.id = quiz_assignments.quiz_id
      AND documents.user_id = auth.uid()
    )
    AND assigned_by = auth.uid()
  );

CREATE POLICY "Teachers can update assignments for their quizzes"
  ON quiz_assignments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
      JOIN documents ON documents.id = quizzes.document_id
      WHERE quizzes.id = quiz_assignments.quiz_id
      AND documents.user_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can delete assignments for their quizzes"
  ON quiz_assignments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
      JOIN documents ON documents.id = quizzes.document_id
      WHERE quizzes.id = quiz_assignments.quiz_id
      AND documents.user_id = auth.uid()
    )
  );

-- RLS Policies for quiz_links
CREATE POLICY "Teachers can view links for their quizzes"
  ON quiz_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
      JOIN documents ON documents.id = quizzes.document_id
      WHERE quizzes.id = quiz_links.quiz_id
      AND documents.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view active quiz links by token (for anonymous access)"
  ON quiz_links FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));

CREATE POLICY "Teachers can create links for their quizzes"
  ON quiz_links FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quizzes
      JOIN documents ON documents.id = quizzes.document_id
      WHERE quizzes.id = quiz_links.quiz_id
      AND documents.user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Teachers can update links for their quizzes"
  ON quiz_links FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
      JOIN documents ON documents.id = quizzes.document_id
      WHERE quizzes.id = quiz_links.quiz_id
      AND documents.user_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can delete links for their quizzes"
  ON quiz_links FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
      JOIN documents ON documents.id = quizzes.document_id
      WHERE quizzes.id = quiz_links.quiz_id
      AND documents.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. TRIGGERS
-- ============================================================================

-- Trigger to update updated_at for communities
CREATE TRIGGER update_communities_updated_at
  BEFORE UPDATE ON communities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at for quiz_assignments
CREATE TRIGGER update_quiz_assignments_updated_at
  BEFORE UPDATE ON quiz_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at for quiz_links
CREATE TRIGGER update_quiz_links_updated_at
  BEFORE UPDATE ON quiz_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. UPDATE ATTEMPTS RLS FOR ANONYMOUS ACCESS
-- ============================================================================

-- Allow anonymous attempts via quiz links
CREATE POLICY "Allow anonymous attempts via valid quiz links"
  ON attempts FOR INSERT
  WITH CHECK (
    (is_anonymous = true AND link_token IS NOT NULL AND user_id IS NULL AND EXISTS (
      SELECT 1 FROM quiz_links
      WHERE quiz_links.unique_token = attempts.link_token
      AND quiz_links.is_active = true
      AND (quiz_links.expires_at IS NULL OR quiz_links.expires_at > NOW())
    ))
    OR (auth.uid() = user_id)
  );

-- Allow viewing attempts made via quiz links (for teachers)
CREATE POLICY "Teachers can view attempts for their quiz links"
  ON attempts FOR SELECT
  USING (
    (auth.uid() = user_id) OR
    (is_anonymous = true AND link_token IS NOT NULL AND EXISTS (
      SELECT 1 FROM quiz_links
      JOIN quizzes ON quizzes.id = quiz_links.quiz_id
      JOIN documents ON documents.id = quizzes.document_id
      WHERE quiz_links.unique_token = attempts.link_token
      AND documents.user_id = auth.uid()
    ))
  );

-- Allow anonymous users to view their own anonymous attempts (for results page)
CREATE POLICY "Anonymous users can view their own attempts via link_token"
  ON attempts FOR SELECT
  USING (
    (is_anonymous = true AND link_token IS NOT NULL)
    -- Note: This is a simplified policy. In production, you might want to add
    -- additional checks like storing a session token or using a more secure method
  );

-- ============================================================================
-- 7. COMMENTS
-- ============================================================================

COMMENT ON TABLE lesson_quizzes IS 'Junction table linking quizzes to lessons';
COMMENT ON TABLE communities IS 'Class/community groups created by teachers';
COMMENT ON TABLE community_members IS 'Membership in communities (supports both authenticated users and student profiles)';
COMMENT ON TABLE quiz_assignments IS 'Targeted quiz distribution to users, student profiles, or communities';
COMMENT ON TABLE quiz_links IS 'Anonymous shareable links for quizzes';
COMMENT ON COLUMN attempts.assignment_id IS 'Reference to quiz_assignments if quiz was taken via assignment';
COMMENT ON COLUMN attempts.link_token IS 'Token from quiz_links if quiz was taken via anonymous link';
COMMENT ON COLUMN attempts.is_anonymous IS 'Whether the attempt was made via anonymous link';

