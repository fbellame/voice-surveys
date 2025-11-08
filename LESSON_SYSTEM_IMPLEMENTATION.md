# Voice Teacher / Lesson System Implementation

## Overview
This document outlines the transformation of the voice survey app into a voice teacher/lesson system. The system allows teachers to create lessons with PDF documents, configure quiz questions, and track student performance.

## Completed Implementation

### 1. Database Schema (✅ Completed)
**File:** `supabase/migrations/20250120000000_add_lesson_system.sql`

Added the following database structures:
- **Campaign table updates:**
  - `lesson_type` field (survey or lesson)
  - `document_url` and `document_text` for PDF storage
  
- **Question table updates:**
  - `correct_answer` - stores the correct answer for quiz questions
  - `is_quiz_question` - flag to mark quiz questions
  - `points` - points awarded for correct answer
  - `explanation` - explanation shown after answering

- **New tables:**
  - `lesson_documents` - stores uploaded PDF documents
  - `student_profiles` - student information
  - `lesson_performance` - tracks student performance on lessons

- **Answer table updates:**
  - `is_correct` - whether answer is correct
  - `points_earned` - points earned for this answer
  - `feedback` - AI-generated feedback
  - `response_time_seconds` - time taken to answer

### 2. LiveKit Agent Updates (✅ Completed)
**Files:** 
- `services/livekit-agent/main.py`
- `services/livekit-agent/user_data.py`
- `services/livekit-agent/api_client.py`

**Key Features Added:**
- **Lesson Mode Detection:** Agent detects if campaign is a lesson (`lesson_type == "lesson"`)
- **Quiz Evaluation:** 
  - `evaluate_answer_correctness()` - fuzzy matching for answer evaluation
  - `submit_quiz_answer()` - submits answers with correctness and scoring
  - `evaluate_quiz_answer()` - function tool for LLM to evaluate answers
  
- **Encouragement System:**
  - Positive feedback for correct answers
  - Supportive feedback for incorrect answers
  - Performance tracking throughout the lesson
  
- **Performance Tracking:**
  - Tracks correct/incorrect answers
  - Calculates points and scores
  - Creates performance records on completion

- **Updated Prompts:**
  - Lesson mode uses encouraging, teacher-like prompts
  - Survey mode maintains original survey prompts

## Remaining Work

### 3. PDF Upload Functionality (⏳ Pending)
**Location:** `apps/survey-hub/`

**Tasks:**
- Add PDF upload component to campaign/lesson creation
- Integrate with Supabase Storage for file storage
- Extract text from PDF (using a library like pdf-parse or similar)
- Store extracted text in `campaign.document_text` and file URL in `campaign.document_url`
- Display uploaded documents in lesson management UI

**Suggested Implementation:**
- Use Supabase Storage bucket for PDFs
- Client-side PDF parsing (pdf.js or similar)
- Or server-side parsing via Edge Function

### 4. Frontend UI Transformation (⏳ Pending)
**Location:** `apps/survey-hub/`

**Tasks:**
- Rename "Campaigns" to "Lessons" in UI
- Add lesson type selector (Survey vs Lesson)
- Add quiz question configuration UI:
  - Checkbox to mark question as quiz question
  - Input for correct answer
  - Points field
  - Explanation field
- Add document upload section
- Add student performance dashboard:
  - List of students who completed lessons
  - Performance metrics (scores, correct answers, etc.)
  - Progress tracking

**Files to Update:**
- `apps/survey-hub/src/pages/CreateCampaign.tsx` → `CreateLesson.tsx`
- `apps/survey-hub/src/pages/Campaigns.tsx` → `Lessons.tsx`
- `apps/survey-hub/src/pages/Analytics.tsx` - add performance dashboard

### 5. Student Interface Updates (⏳ Pending)
**Location:** `apps/live-chatter/`

**Tasks:**
- Display quiz question indicators
- Show real-time feedback (correct/incorrect)
- Display encouragement messages
- Show performance progress (score, correct answers count)
- Display final performance summary

**Files to Update:**
- `apps/live-chatter/src/components/audio/SimpleSurvey.tsx`
- `apps/live-chatter/src/pages/SurveyPage.tsx`

### 6. Student Management (⏳ Pending)
**Location:** `apps/survey-hub/`

**Tasks:**
- Create student profile management page
- Add student assignment to lessons
- Display student progress across lessons
- Add student performance analytics

## API Endpoints Needed

The following API endpoints need to be added to `supabase/functions/survey-api/index.ts`:

1. **POST /lesson-performance** - Create lesson performance record
   - Body: `{ submission_id, campaign_id, total_questions, correct_answers, total_points, points_earned, score_percentage, completion_time_seconds? }`

2. **GET /lessons/:id/performance** - Get performance data for a lesson
   - Returns: List of student performances

3. **GET /students/:id/progress** - Get student progress across all lessons
   - Returns: List of lessons with performance data

4. **POST /documents** - Upload lesson document
   - Body: `{ campaign_id, file_name, file_url, extracted_text }`

## Testing Checklist

- [ ] Create a lesson with quiz questions
- [ ] Upload a PDF document
- [ ] Test quiz answer evaluation (correct/incorrect)
- [ ] Verify performance tracking
- [ ] Test student interface with quiz mode
- [ ] Verify performance dashboard displays correctly
- [ ] Test PDF text extraction and storage

## Migration Instructions

1. **Run Database Migration:**
   ```bash
   supabase migration up
   ```

2. **Update API Client:**
   The API client has been updated with new methods. Ensure the Edge Function (`supabase/functions/survey-api/index.ts`) implements the new endpoints.

3. **Deploy Agent:**
   The LiveKit agent has been updated. Redeploy the agent service.

4. **Update Frontend:**
   Follow the tasks outlined in sections 3-6 above.

## Notes

- The system maintains backward compatibility with surveys
- Lessons and surveys can coexist in the same database
- The agent automatically detects lesson mode based on `campaign.lesson_type`
- Quiz evaluation uses fuzzy matching - consider using LLM-based semantic evaluation for better accuracy in production

