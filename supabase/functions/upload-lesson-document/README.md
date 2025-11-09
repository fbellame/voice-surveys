# Upload Lesson Document Edge Function

This edge function handles PDF uploads for lessons and uses OpenAI to automatically generate quiz questions and lesson prompts.

## Features

1. **PDF Upload**: Uploads PDF files to Supabase storage
2. **Text Extraction**: Extracts text from PDF files using pdfjs-dist
3. **AI Quiz Generation**: Uses OpenAI GPT-4o-mini to generate 5 quiz questions from PDF content
4. **AI Lesson Prompt Generation**: Uses OpenAI GPT-4o-mini to generate lesson introduction prompts

## Setup

### 1. Set OpenAI API Key

You need to set the `OPENAI_API_KEY` environment variable in your Supabase project:

**Via Supabase Dashboard:**
1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions** → **Settings**
3. Add a new secret: `OPENAI_API_KEY` with your OpenAI API key value

**Via Supabase CLI:**
```bash
supabase secrets set OPENAI_API_KEY=your-openai-api-key-here
```

### 2. Deploy the Function

```bash
supabase functions deploy upload-lesson-document
```

## Usage

The function accepts a POST request with a PDF file in multipart/form-data format.

**Request:**
- Method: `POST`
- Headers: 
  - `Authorization: Bearer <user-access-token>`
  - `apikey: <supabase-anon-key>`
- Body: `multipart/form-data` with a `file` field containing the PDF

**Response:**
```json
{
  "success": true,
  "filePath": "lessons/1234567890-abc123.pdf",
  "fileName": "1234567890-abc123.pdf",
  "publicUrl": "https://...",
  "fileSize": 123456,
  "uploadedBy": "user-uuid",
  "extractedText": "Full text extracted from PDF...",
  "quizQuestions": [
    {
      "question_text": "What is...?",
      "correct_answer": "Answer",
      "points": 1,
      "explanation": "Explanation",
      "is_quiz_question": true,
      "question_order": 1
    }
  ],
  "lessonPrompt": "Generated lesson introduction prompt..."
}
```

## Error Handling

- If `OPENAI_API_KEY` is not set, the function will still upload the PDF but skip AI generation
- If PDF text extraction fails, the function will return an error
- If OpenAI API calls fail, the function will log the error but still return the uploaded file info

## Dependencies

- `pdfjs-dist@4.0.379`: For PDF text extraction
- OpenAI API: For quiz question and prompt generation

