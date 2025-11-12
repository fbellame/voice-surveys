# Teacher Hub - PDF to Quiz

Transform your PDFs into interactive quizzes using AI.

## Features

- 📄 Upload PDF documents
- 🤖 AI-powered question generation
- ✅ Multiple question types (MCQ, True/False, Short Answer)
- 📊 Automatic grading with feedback
- 📈 Performance tracking

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env.local
```

Fill in your Supabase credentials:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. Run database migrations:
```bash
cd ../supabase
supabase migration up
```

4. Deploy Edge Functions:
```bash
supabase functions deploy process-pdf
supabase functions deploy generate-quiz
supabase functions deploy grade
```

5. Set Edge Function secrets:
```bash
supabase secrets set OPENAI_API_KEY=your_openai_key
```

6. Run the development server:
```bash
npm run dev
```

## Architecture

- **Frontend**: Next.js 14 (App Router) on Vercel
- **Backend**: Supabase (Postgres + Storage + Edge Functions)
- **AI**: OpenAI API (gpt-4o-mini for questions, text-embedding-3-small for embeddings)

## Usage

1. Upload a PDF document
2. Wait for text extraction and chunking
3. Generate a quiz from the document
4. Take the quiz
5. View results with detailed feedback

