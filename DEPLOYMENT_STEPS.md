# Deployment Steps for Document Lessons Feature

## Status
✅ Migration file created: `supabase/migrations/20250123000001_create_document_lessons.sql`
✅ Edge function created: `supabase/functions/generate-lesson/`

## Steps to Deploy

### 1. Apply Database Migration

You have two options:

#### Option A: Using Supabase CLI (Recommended)
```bash
cd /Users/faridbellameche/projects/teacher-hub
supabase db push
```

This will apply all pending migrations including the new `20250123000001_create_document_lessons.sql` migration.

#### Option B: Using Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `supabase/migrations/20250123000001_create_document_lessons.sql`
4. Paste and run the SQL in the editor

### 2. Deploy Edge Function

Once your Supabase project is active, deploy the edge function:

```bash
cd /Users/faridbellameche/projects/teacher-hub
supabase functions deploy generate-lesson
```

**Note**: Make sure your Supabase project is active. If you see an "INACTIVE" status error, you may need to:
- Check your Supabase project status in the dashboard
- Ensure you're logged in: `supabase login`
- Link your project: `supabase link --project-ref <your-project-ref>`

### 3. Verify Deployment

After deployment, verify:

1. **Database Tables**: Check that these tables exist:
   - `document_lessons`
   - `lesson_parts`
   - `lesson_part_chunks`
   - `lesson_progress`

2. **Edge Function**: Test the function:
   ```bash
   curl -X POST https://<your-project-ref>.supabase.co/functions/v1/generate-lesson \
     -H "Authorization: Bearer <your-anon-key>" \
     -H "Content-Type: application/json" \
     -d '{"document_id": "<test-document-id>"}'
   ```

3. **Frontend**: Try generating a lesson from the document page in your app.

## Troubleshooting

### Migration Issues
- If you get RLS policy errors, make sure the migration runs completely
- Check that the `documents` table exists before running the migration

### Edge Function Issues
- Ensure `OPENAI_API_KEY` is set in your Supabase project secrets
- Check function logs in Supabase dashboard for errors
- Verify the function has proper CORS headers

### Frontend Issues
- Make sure the frontend is pointing to the correct Supabase project
- Check browser console for any API errors
- Verify RLS policies allow the current user to access lessons

## Quick Check Commands

```bash
# Check migration status
supabase migration list

# Check function status
supabase functions list

# View function logs
supabase functions logs generate-lesson
```

