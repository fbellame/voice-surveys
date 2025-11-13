# Quiz-Lesson-Community Integration Plan

## Overview
This plan outlines the implementation required to:
1. Bundle quizzes into lessons
2. Create a community/class system
3. Enable quiz distribution (individual, community-wide, or anonymous links)

## Current State Analysis

### Existing Systems
- **Quizzes**: Independent entities linked to documents (`quizzes` table)
- **Lessons**: Separate system with `lesson` table and `lesson_question` table
- **Student Profiles**: `student_profiles` table exists for lesson tracking
- **No Community System**: No way to organize users into groups/classes
- **No Quiz Sharing**: Quizzes can only be accessed directly by authenticated users

### Gaps Identified
1. No relationship between quizzes and lessons
2. No community/class management system
3. No quiz assignment/distribution mechanism
4. No anonymous link system for quizzes (only exists for lessons)

---

## Implementation Plan

### Phase 1: Database Schema Changes

#### 1.1 Link Quizzes to Lessons
**Table: `lesson_quizzes`** (junction table)
```sql
- id: UUID (primary key)
- lesson_id: BIGINT (foreign key to lesson)
- quiz_id: UUID (foreign key to quizzes)
- order: INTEGER (optional, for ordering quizzes within a lesson)
- created_at: TIMESTAMPTZ
```

**Rationale**: Junction table allows:
- Multiple quizzes per lesson
- Same quiz in multiple lessons
- Ordering of quizzes within a lesson

#### 1.2 Community/Class System
**Table: `communities`**
```sql
- id: UUID (primary key)
- name: TEXT (e.g., "Math 101", "Science Class")
- description: TEXT (optional)
- teacher_id: UUID (foreign key to auth.users)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

**Table: `community_members`**
```sql
- id: UUID (primary key)
- community_id: UUID (foreign key to communities)
- member_type: TEXT CHECK (member_type IN ('user', 'student_profile'))
- user_id: UUID (nullable, foreign key to auth.users)
- student_profile_id: UUID (nullable, foreign key to student_profiles)
- role: TEXT DEFAULT 'student' CHECK (role IN ('student', 'assistant', 'teacher'))
- joined_at: TIMESTAMPTZ
- created_at: TIMESTAMPTZ
```

**Rationale**: 
- Supports both authenticated users and anonymous student profiles
- Allows role-based access (students, assistants, co-teachers)
- Flexible membership model

#### 1.3 Quiz Distribution System
**Table: `quiz_assignments`**
```sql
- id: UUID (primary key)
- quiz_id: UUID (foreign key to quizzes)
- assigned_by: UUID (foreign key to auth.users - teacher)
- assignment_type: TEXT CHECK (assignment_type IN ('user', 'student_profile', 'community'))
- user_id: UUID (nullable, for individual user assignment)
- student_profile_id: UUID (nullable, for individual student assignment)
- community_id: UUID (nullable, for community-wide assignment)
- due_date: TIMESTAMPTZ (optional)
- instructions: TEXT (optional)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

**Table: `quiz_links`** (for anonymous sharing)
```sql
- id: UUID (primary key)
- quiz_id: UUID (foreign key to quizzes)
- unique_token: TEXT (unique, for URL)
- name: TEXT (optional, link name/description)
- is_active: BOOLEAN DEFAULT true
- max_attempts: INTEGER (optional, limit attempts per token)
- expires_at: TIMESTAMPTZ (optional)
- created_by: UUID (foreign key to auth.users)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

**Rationale**:
- `quiz_assignments` handles targeted distribution (individual or community)
- `quiz_links` handles anonymous/public access
- Supports due dates and instructions for assignments
- Token-based anonymous links similar to `lesson_links` pattern

#### 1.4 Update Attempts Table
**Add fields to `attempts` table:**
```sql
- assignment_id: UUID (nullable, foreign key to quiz_assignments)
- link_token: TEXT (nullable, for anonymous link attempts)
- is_anonymous: BOOLEAN DEFAULT false
```

**Rationale**: Track how the quiz was accessed (assignment vs anonymous link)

---

### Phase 2: Row Level Security (RLS) Policies

#### 2.1 Communities
- Teachers can view/manage their own communities
- Members can view their communities
- Teachers can add/remove members

#### 2.2 Community Members
- Teachers can view/manage members of their communities
- Members can view other members of their communities

#### 2.3 Quiz Assignments
- Teachers can create assignments for their quizzes
- Assigned users can view their assignments
- Community members can view assignments for their communities

#### 2.4 Quiz Links
- Teachers can create/manage links for their quizzes
- Anyone with the token can access (if active and not expired)

---

### Phase 3: Backend/API Changes

#### 3.1 Edge Functions
**New Function: `create-quiz-assignment`**
- Create assignments for users, student profiles, or communities
- Validate permissions (teacher owns quiz)
- Handle bulk community assignments

**New Function: `create-quiz-link`**
- Generate unique token
- Create quiz_link record
- Return shareable URL

**Update Function: `grade`**
- Handle anonymous attempts (link_token)
- Track assignment_id if applicable

#### 3.2 LiveKit Agent Updates
- No changes needed (agent doesn't handle quiz distribution)

---

### Phase 4: Frontend Changes

#### 4.1 Community Management UI
**New Page: `/communities`**
- List all communities (teacher view)
- Create new community
- View/edit community details
- Manage members (add/remove)

**New Page: `/communities/[id]`**
- Community details
- Member list
- Quiz assignments for this community
- Performance analytics

#### 4.2 Quiz-Lesson Integration UI
**Update: `/lessons/[id]`**
- Add "Quizzes" section
- Button to "Add Quiz to Lesson"
- List quizzes in lesson
- Reorder quizzes
- Remove quiz from lesson

**Update: `/quizzes/[id]`**
- Show which lessons include this quiz
- Add quiz to lesson (dropdown)

#### 4.3 Quiz Distribution UI
**Update: `/quizzes/[id]`**
- Add "Share" or "Assign" section
- Three tabs/options:
  1. **Assign to Individual**: Search users/student profiles
  2. **Assign to Community**: Select community, assign to all members
  3. **Create Anonymous Link**: Generate shareable link

**New Component: `QuizAssignmentManager`**
- List all assignments for a quiz
- Show assignment details (who, when, due date)
- Revoke assignments
- View attempt status

**New Component: `QuizLinkManager`**
- List all links for a quiz
- Create new links
- Deactivate/activate links
- Copy link URLs
- View link usage stats

#### 4.4 Student/Anonymous Quiz Access
**Update: `/quizzes/[id]` (public/anonymous view)**
- Check if accessed via assignment or link
- Show assignment details (due date, instructions) if applicable
- Allow anonymous users to take quiz via link
- Track attempt with assignment_id or link_token

**New Page: `/quiz/[token]`** (for anonymous links)
- Load quiz by token
- Allow anonymous quiz taking
- Create attempt with link_token

**New Page: `/my-assignments`** (for students)
- List all quiz assignments
- Show due dates
- Link to take quiz
- Show completion status

---

### Phase 5: Data Migration

#### 5.1 Existing Data
- No migration needed for existing quizzes/lessons
- Communities start empty (teachers create them)
- Existing attempts remain unchanged

---

## Implementation Order

### Step 1: Database Schema (Foundation)
1. Create `lesson_quizzes` table
2. Create `communities` table
3. Create `community_members` table
4. Create `quiz_assignments` table
5. Create `quiz_links` table
6. Update `attempts` table
7. Add RLS policies

### Step 2: Backend APIs
1. Create edge functions for assignments and links
2. Update grade function to handle new fields

### Step 3: Community Management UI
1. Communities list page
2. Create/edit community
3. Member management

### Step 4: Quiz-Lesson Integration
1. Add quizzes to lessons UI
2. Display quizzes in lessons
3. Remove/reorder quizzes

### Step 5: Quiz Distribution
1. Assignment UI (individual)
2. Assignment UI (community)
3. Anonymous link UI
4. Assignment/link management components

### Step 6: Student Access
1. My assignments page
2. Anonymous quiz link page
3. Update quiz taking flow to handle assignments/links

---

## Database Schema Summary

### New Tables
1. `lesson_quizzes` - Links quizzes to lessons
2. `communities` - Class/community groups
3. `community_members` - Community membership
4. `quiz_assignments` - Targeted quiz distribution
5. `quiz_links` - Anonymous quiz sharing

### Modified Tables
1. `attempts` - Add assignment_id, link_token, is_anonymous

---

## Security Considerations

1. **RLS Policies**: Ensure teachers can only manage their own quizzes/communities
2. **Token Security**: Use cryptographically secure tokens for anonymous links
3. **Access Control**: Verify assignment/link validity before allowing quiz access
4. **Rate Limiting**: Consider rate limits on anonymous link attempts
5. **Expiration**: Support link expiration and max attempts

---

## Future Enhancements (Out of Scope)

1. Quiz scheduling (assign with start/end dates)
2. Quiz attempts limit per assignment
3. Community-based analytics
4. Bulk import of community members
5. Quiz templates for common assignments
6. Notification system for assignments
7. Quiz attempt reminders

---

## Testing Checklist

- [ ] Create community and add members
- [ ] Add quiz to lesson
- [ ] Assign quiz to individual user
- [ ] Assign quiz to community (all members)
- [ ] Create anonymous quiz link
- [ ] Take quiz via assignment
- [ ] Take quiz via anonymous link
- [ ] Verify RLS policies
- [ ] Test link expiration
- [ ] Test max attempts on links
- [ ] Verify attempt tracking (assignment_id, link_token)

