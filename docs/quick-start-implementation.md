# Quick Start Implementation Guide

## 🚀 Getting Started

This guide will help you set up the complete voice survey solution in under 30 minutes.

## 📋 Prerequisites

- Node.js 18+ and npm/yarn
- Python 3.9+
- Supabase account
- LiveKit Cloud account
- OpenAI API key
- AWS account (for S3)

## 🛠️ Step-by-Step Setup

### 1. Clone and Setup Repository

```bash
git clone <your-repo-url>
cd voice-surveys

# Install dependencies for all apps
npm install
cd apps/survey-hub && npm install
cd ../live-chatter && npm install
cd ../../services/livekit-agent && pip install -r requirements.txt
```

### 2. Configure Supabase

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create new project
   - Note your project URL and API keys

2. **Run Database Migrations**
   ```bash
   cd supabase
   supabase db reset
   ```

3. **Deploy Edge Functions**
   ```bash
   supabase functions deploy survey-api
   ```

### 3. Configure LiveKit Cloud

1. **Create LiveKit Project**
   - Go to [cloud.livekit.io](https://cloud.livekit.io)
   - Create new project
   - Note your API keys

2. **Configure Agent**
   ```bash
   cd services/livekit-agent
   cp .env.example .env
   # Edit .env with your LiveKit credentials
   ```

### 4. Setup Environment Variables

Create `.env` files for each application:

**Survey Hub** (`apps/survey-hub/.env`):
```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_LIVEKIT_URL=your_livekit_url
VITE_LIVEKIT_API_KEY=your_livekit_api_key
```

**Live Chatter** (`apps/live-chatter/.env`):
```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_LIVEKIT_URL=your_livekit_url
VITE_LIVEKIT_API_KEY=your_livekit_api_key
```

**Python Agent** (`services/livekit-agent/.env`):
```bash
LIVEKIT_URL=your_livekit_url
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_role_key
OPENAI_API_KEY=your_openai_key
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_S3_BUCKET=voice-surveys
```

### 5. Start Development Servers

**Terminal 1 - Survey Hub:**
```bash
cd apps/survey-hub
npm run dev
# http://localhost:5173
```

**Terminal 2 - Live Chatter:**
```bash
cd apps/live-chatter
npm run dev
# http://localhost:5174
```

**Terminal 3 - Python Agent:**
```bash
cd services/livekit-agent
python main.py
```

### 6. Create Your First Campaign

1. **Open Survey Hub** (http://localhost:5173)
2. **Sign up/Sign in** with Supabase Auth
3. **Create Campaign:**
   - Click "New Campaign"
   - Name: "Customer Satisfaction Survey"
   - Intro Prompt: "You are conducting a customer satisfaction survey..."
   - Greeting: "Hello, thank you for participating in our survey"
4. **Add Questions:**
   - "How satisfied are you with our service?"
   - "What could we improve?"
   - "Would you recommend us to others?"

### 7. Test Voice Survey

1. **Generate Survey Link:**
   - In Survey Hub, click "Generate Link"
   - Copy the unique URL

2. **Test Voice Survey:**
   - Open Live Chatter (http://localhost:5174)
   - Paste the survey link
   - Click "Join Survey"
   - Allow microphone access
   - Start talking!

## 🔧 Key Configuration Files

### LiveKit Configuration
```typescript
// apps/live-chatter/src/config/livekit.ts
export const LIVEKIT_CONFIG = {
  url: import.meta.env.VITE_LIVEKIT_URL,
  apiKey: import.meta.env.VITE_LIVEKIT_API_KEY,
  apiSecret: import.meta.env.VITE_LIVEKIT_API_SECRET
}
```

### Supabase Client
```typescript
// apps/survey-hub/src/integrations/supabase/client.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

### Python Agent Configuration
```python
# services/livekit-agent/config.py
import os
from dotenv import load_dotenv

load_dotenv()

LIVEKIT_CONFIG = {
    'url': os.getenv('LIVEKIT_URL'),
    'api_key': os.getenv('LIVEKIT_API_KEY'),
    'api_secret': os.getenv('LIVEKIT_API_SECRET')
}
```

## 🧪 Testing Checklist

- [ ] Survey Hub loads without errors
- [ ] Can create new campaign
- [ ] Can add questions to campaign
- [ ] Can generate survey link
- [ ] Live Chatter loads survey link
- [ ] Can join voice room
- [ ] Python agent connects to room
- [ ] Voice conversation works
- [ ] Answers are saved to database
- [ ] Can view responses in Survey Hub

## 🚨 Common Issues & Solutions

### Issue: "LiveKit connection failed"
**Solution:** Check your LiveKit credentials and ensure the agent is running

### Issue: "Supabase connection error"
**Solution:** Verify your Supabase URL and API keys

### Issue: "Microphone not working"
**Solution:** Check browser permissions and HTTPS requirement

### Issue: "Agent not responding"
**Solution:** Check Python agent logs and OpenAI API key

## 📊 Monitoring

### Check Agent Logs
```bash
cd services/livekit-agent
tail -f survey_agent.log
```

### Check Supabase Logs
```bash
supabase logs
```

### Check Frontend Console
Open browser DevTools to see any JavaScript errors

## 🚀 Production Deployment

### Frontend Deployment (Vercel)
```bash
# Survey Hub
cd apps/survey-hub
vercel --prod

# Live Chatter
cd apps/live-chatter
vercel --prod
```

### Python Agent Deployment (Digital Ocean VM)
```bash
# On Digital Ocean VM
cd services/livekit-agent
docker build -t voice-survey-agent .
docker run -d --env-file .env voice-survey-agent

# Or using systemd service (recommended for production)
sudo systemctl enable --now livekit-agent@1
sudo systemctl status livekit-agent@1
```

### Database Migration
```bash
supabase db push
supabase functions deploy
```

## 📚 Next Steps

1. **Customize the UI** - Modify components in `src/components/`
2. **Add Analytics** - Implement dashboard in Survey Hub
3. **Enhance Agent** - Add more sophisticated conversation logic
4. **Scale Up** - Deploy to production with proper monitoring

---

**Need Help?** Check the main documentation in `/docs/voice-survey-architecture-design.md`
