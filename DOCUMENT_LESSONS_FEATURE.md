# Document Lessons Feature

## Overview

This feature adds a comprehensive learning system that allows users to create structured, multi-part lessons from document chunks. These lessons help students learn the content before taking quizzes, providing a progressive learning experience.

## Features

### 1. **Structured Multi-Part Lessons**
   - Lessons are automatically divided into 3-6 parts based on document content
   - Each part builds progressively on previous knowledge
   - Parts are organized logically from document chunks

### 2. **Rich Content per Part**
   Each lesson part includes:
   - **Title**: Descriptive name for the part
   - **Content**: Comprehensive explanation (3-5 paragraphs)
   - **Summary**: Brief recap of key points
   - **Learning Objectives**: 2-3 clear objectives
   - **Key Concepts**: 3-5 important concepts covered
   - **Examples**: 1-2 practical examples or illustrations

### 3. **Progress Tracking**
   - Users can track their progress through lessons
   - Parts can be marked as complete
   - Progress is saved per user and lesson
   - Visual indicators show completed vs. current parts

### 4. **Interactive Navigation**
   - Easy navigation between parts
   - Visual progress bar
   - Part completion indicators
   - Smooth transitions between sections

## Database Schema

### Tables Created

1. **document_lessons**
   - Stores lesson metadata (title, overview, duration)
   - Links to source document

2. **lesson_parts**
   - Stores individual parts of a lesson
   - Contains all content (objectives, concepts, examples)
   - Ordered by part_number

3. **lesson_part_chunks**
   - Links lesson parts to source document chunks
   - Tracks which chunks were used for each part

4. **lesson_progress**
   - Tracks user progress through lessons
   - Stores completed parts and current position
   - Tracks time spent and last access

## API Endpoints

### Generate Lesson
- **Function**: `generate-lesson`
- **Method**: POST
- **Body**:
  ```json
  {
    "document_id": "uuid",
    "title": "optional title",
    "parts_count": "optional number of parts"
  }
  ```
- **Response**:
  ```json
  {
    "lesson_id": "uuid",
    "parts_count": 5,
    "message": "Lesson generated successfully"
  }
  ```

## Frontend Components

### 1. Document Page (`/documents/[id]`)
   - Added "Generate Learning Lesson" button
   - Displays list of existing lessons for the document
   - Links to lesson viewer

### 2. Lesson Viewer (`/lessons/[id]`)
   - Full-screen lesson display
   - Part navigation sidebar
   - Progress tracking
   - Rich content display with:
     - Learning objectives (purple highlight)
     - Main content
     - Key concepts (yellow badges)
     - Examples (green highlight)
     - Summary section

## User Flow

1. **Generate Lesson**
   - User uploads a document
   - Clicks "Generate Learning Lesson" on document page
   - System creates structured lesson from document chunks

2. **Study Lesson**
   - User navigates to lesson page
   - Reads through each part sequentially
   - Marks parts as complete
   - Reviews learning objectives, concepts, and examples

3. **Take Quiz**
   - After completing lesson, user can proceed to quiz
   - Better prepared with structured learning

## Technical Details

### Lesson Generation
- Uses OpenAI GPT-4o-mini to generate educational content
- Automatically determines optimal number of parts (3-6)
- Distributes document chunks evenly across parts
- Creates progressive, building-block structure

### Content Quality
- Each part is comprehensive and educational
- Content is tailored to help students understand before testing
- Examples and concepts are extracted from actual document content
- Learning objectives guide student focus

## Future Enhancements

Potential improvements:
- Quiz integration (link from lesson to quiz)
- Lesson sharing (similar to quiz links)
- Analytics on lesson completion rates
- Adaptive learning paths
- Interactive exercises within lessons
- Note-taking capabilities
- Lesson recommendations based on quiz performance

## Files Created/Modified

### Database
- `supabase/migrations/20250123000001_create_document_lessons.sql`

### Backend
- `supabase/functions/generate-lesson/index.ts`
- `supabase/functions/generate-lesson/deno.json`

### Frontend
- `apps/teacher-hub/src/app/lessons/[id]/page.tsx` (new)
- `apps/teacher-hub/src/app/documents/[id]/page.tsx` (modified)

## Usage Example

```typescript
// Generate a lesson
const { data } = await supabase.functions.invoke("generate-lesson", {
  body: { document_id: "uuid-here" }
});

// Navigate to lesson
router.push(`/lessons/${data.lesson_id}`);
```

## Benefits

1. **Better Learning Outcomes**: Structured lessons help students understand before testing
2. **Progressive Learning**: Multi-part structure builds knowledge incrementally
3. **Engagement**: Rich content with objectives, concepts, and examples
4. **Tracking**: Progress tracking helps students see their advancement
5. **Flexibility**: Can study at own pace, review parts as needed

