# LiveKit Agent Local Startup Guide

This guide will help you run your Python agent locally with Supabase database and edge functions.

## Prerequisites

1. **Python 3.8+** installed
2. **Supabase CLI** installed and configured
3. **LiveKit server** running locally
4. **API keys** for OpenAI, Deepgram, AWS S3 (optional)

## Step 1: Setup Environment

Run the setup script to create your environment file:

```bash
cd services/livekit-agent
python setup_local.py
```

This will create a `.env` file with local development settings.

## Step 2: Install Dependencies

```bash
pip install -r requirements.txt
```

## Step 3: Start Supabase Locally

From the project root directory:

```bash
supabase start
```

This will start:
- **Database**: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- **API**: `http://127.0.0.1:54321`
- **Studio**: `http://127.0.0.1:54323`
- **Edge Functions**: Available at `http://127.0.0.1:54321/functions/v1/survey-api`

## Step 4: Configure API Keys

Edit the `.env` file and add your actual API keys:

```bash
# Required
OPENAI_API_KEY=your_openai_api_key
DEEPGRAM_API_KEY=your_deepgram_api_key

# Optional (for S3 recording)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your_s3_bucket_name

# Optional (for phone calls)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
```

## Step 5: Start LiveKit Server

You need a LiveKit server running. You can either:

### Option A: Use LiveKit Cloud (Recommended for testing)
- Sign up at https://cloud.livekit.io
- Get your API key and secret
- Update your `.env` file with the cloud URL

### Option B: Run LiveKit Locally
```bash
# Install LiveKit server
curl -sSL https://get.livekit.io | bash

# Start LiveKit server
livekit-server --dev
```

## Step 6: Test the Setup

### Test Supabase Connection
```bash
curl http://127.0.0.1:54321/functions/v1/survey-api
```

Should return:
```json
{
  "message": "Survey API is working",
  "method": "GET",
  "fullPath": "/functions/v1/survey-api",
  "path": "",
  "searchParams": {},
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Test API Client
```bash
python test_api_integration.py
```

## Step 7: Run the Agent

```bash
python main.py dev
```

The agent will:
1. Connect to LiveKit server
2. Listen for incoming calls
3. Use Supabase edge functions for data operations
4. Store survey responses in the local database

## Troubleshooting

### Common Issues

1. **Supabase not running**
   ```bash
   supabase status
   supabase start
   ```

2. **Edge function not deployed**
   ```bash
   supabase functions deploy survey-api
   ```

3. **Database connection issues**
   - Check if Supabase is running: `supabase status`
   - Verify database URL in `.env`
   - Check logs: `supabase logs`

4. **LiveKit connection issues**
   - Verify LiveKit server is running
   - Check API keys in `.env`
   - Test connection: `curl ws://localhost:7880`

### Debug Mode

The agent runs with maximum debug logging. Check the console output for detailed information about:
- API requests to Supabase
- LiveKit connections
- Survey flow progress

### Logs

- **Supabase logs**: `supabase logs`
- **Agent logs**: Check console output
- **Edge function logs**: `supabase functions logs survey-api`

## Development Workflow

1. **Make changes** to `main.py` or `api_client.py`
2. **Restart the agent**: `python main.py`
3. **Test changes** by creating a new survey call
4. **Check database** in Supabase Studio: http://127.0.0.1:54323

## API Endpoints

Your agent will use these Supabase edge function endpoints:

- `GET /campaigns/{campaign_uri}/details` - Get campaign and questions
- `POST /submissions` - Create survey submission
- `GET /submissions?room_name={room_name}` - Get existing submission
- `POST /submissions/{id}/answers` - Submit survey answers
- `PUT /submissions/{id}` - Update submission (S3 URL)

## Database Schema

The agent expects these tables in your Supabase database:
- `campaign` - Survey campaigns
- `question` - Survey questions
- `survey_submissions` - Survey responses
- `answer` - Individual answers
- `campaign_links` - Survey links
- `survey_invitations` - Personal invitations

Make sure your database is properly migrated and seeded with test data.
