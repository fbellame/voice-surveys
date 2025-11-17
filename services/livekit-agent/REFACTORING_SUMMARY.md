# LiveKit Agent Refactoring Summary

## Overview
The livekit-agent has been completely refactored to work directly with the local Supabase database and the quiz system, replacing the old API-based approach.

## Key Changes

### 1. New Supabase Client (`supabase_client.py`)
- **Replaces**: `api_client.py` (old API-based client)
- **Purpose**: Direct database access to local Supabase instance
- **Features**:
  - Connects to `http://127.0.0.1:54321` by default (local Supabase)
  - Uses service role key for database operations
  - All methods are async and use executors to avoid blocking
  - Works with quiz system: `quizzes`, `questions`, `attempts`, `answers`, `quiz_links`

### 2. Quiz System Integration
- **Old**: Used `lessons` and `campaigns` tables
- **New**: Uses `quizzes` and `questions` tables
- **Quiz Links**: Supports anonymous quiz access via `quiz_links` table
- **Attempts**: Creates `attempts` records for each quiz session
- **Answers**: Saves answers directly to `answers` table

### 3. Automatic Grading
- **Integration**: Calls the `grade` edge function after quiz completion
- **Process**: 
  1. All answers are saved to `answers` table
  2. On completion, calls `/functions/v1/grade` with `attempt_id`
  3. Grade function evaluates all answers and updates `attempts` table with score

### 4. Room Name Format
- **Expected Format**: `quiz-{token}` or room name containing the quiz link token
- **Token Extraction**: Extracts token from room name to look up quiz link
- **Anonymous Access**: Supports anonymous quiz attempts (no user_id required)

## Database Schema Used

### Tables
- `quiz_links`: Quiz sharing links with tokens
- `quizzes`: Quiz definitions
- `questions`: Quiz questions
- `attempts`: Quiz attempt records
- `answers`: Individual answers to questions

### Key Fields
- `attempts.link_token`: Links attempt to quiz link token
- `attempts.is_anonymous`: Marks anonymous attempts
- `attempts.user_id`: NULL for anonymous, user ID for authenticated
- `answers.user_answer`: JSONB field storing the answer
- `answers.is_correct`: Set by grade function
- `answers.feedback`: Set by grade function

## Configuration

### Environment Variables
```bash
SUPABASE_URL=http://127.0.0.1:54321  # Local Supabase
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

### Local Supabase Setup
1. Ensure Supabase is running: `supabase start`
2. Get service role key from Supabase dashboard or config
3. Set in `.env` file in `services/livekit-agent/`

## Usage Flow

1. **Room Creation**: Create LiveKit room with name like `quiz-{token}`
2. **Quiz Loading**: Agent extracts token, looks up quiz link, loads quiz and questions
3. **Attempt Creation**: Creates new attempt record (or resumes existing)
4. **Answer Collection**: As user answers, saves to `answers` table immediately
5. **Completion**: When all questions answered, calls grade function
6. **Grading**: Grade function evaluates answers and calculates score

## Testing

To test the refactored agent:
1. Create a quiz link in the Teacher Hub
2. Get the quiz link token
3. Create a LiveKit room with name `quiz-{token}`
4. Connect to the room
5. Agent will load quiz and start asking questions
6. Answers are saved in real-time
7. On completion, quiz is automatically graded

## Migration Notes

- Old API client (`api_client.py`) is no longer used
- All database operations now go through `supabase_client.py`
- Quiz system replaces lesson/campaign system
- Grade function handles all evaluation (no client-side evaluation)

