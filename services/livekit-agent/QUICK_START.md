# Quick Start Guide

## Current Status ✅
- ✅ Conda environment `alex_livekit` activated
- ✅ LiveKit agents package installed
- ✅ Supabase running locally
- ✅ API client working
- ✅ Edge functions deployed

## Next Steps

### 1. Configure API Keys

Edit the `.env` file and add your actual API keys:

```bash
# Required API Keys
OPENAI_API_KEY=sk-your-openai-api-key-here

# LiveKit Configuration (choose one option)
# Option A: LiveKit Cloud (recommended)
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret

# Option B: Local LiveKit Server
# LIVEKIT_URL=ws://localhost:7880
# LIVEKIT_API_KEY=devkey
# LIVEKIT_API_SECRET=secret
```

### 2. Get API Keys

#### OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Add it to `.env` file

#### LiveKit Cloud (Recommended)
1. Go to https://cloud.livekit.io
2. Sign up and create a project
3. Get your API key and secret from the dashboard
4. Update `.env` file with the cloud URL and credentials

#### LiveKit Local Server (Alternative)
If you prefer to run LiveKit locally:
```bash
# Start LiveKit server locally
livekit-server --dev
```

### 3. Test Configuration

```bash
python start_agent.py
```

### 4. Run the Agent

```bash
python main.py dev
```

## What the Agent Does

1. **Connects to LiveKit** - Handles voice communication
2. **Uses Supabase** - Stores survey data and campaign info
3. **Uses OpenAI** - Generates responses and text-to-speech
4. **Uses Deepgram** - Speech-to-text conversion
5. **Uses Silero** - Voice activity detection

## Testing

To test the agent, you'll need to:
1. Create a survey campaign in your database
2. Create a survey link
3. Join a room with the survey link
4. The agent will automatically start the survey

## Troubleshooting

- **Missing API keys**: Edit `.env` file
- **Supabase not running**: `supabase start`
- **LiveKit connection issues**: Check API keys and URL
- **Import errors**: Make sure you're in the `alex_livekit` conda environment
