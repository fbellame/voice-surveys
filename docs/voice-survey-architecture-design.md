# Voice Survey Solution - Complete Architecture Design

## 🎯 Overview

A comprehensive voice survey platform that enables real-time voice conversations with AI agents, campaign management, and analytics. The solution integrates LiveKit Cloud for real-time communication, Python agents for intelligent conversation handling, Supabase for data persistence, and React frontends for user management and participation.

## 🏗️ System Architecture

```mermaid
graph LR
  %% Layout
  %% ======
  %% Left-to-right for readability in slides
  %% Group nodes by role with consistent colors

  subgraph FE["Frontend Applications"]
    direction TB
    A[Survey Hub<br/>Campaign Management]
    B[Live Chatter<br/>Voice Participation]
  end

  subgraph INFRA["Cloud Infrastructure"]
    direction TB
    C[LiveKit Cloud]
    D[Supabase<br/>Database]
    E[Supabase<br/>Edge Functions]
  end

  subgraph BE["Backend Services"]
    direction TB
    F[LiveKit Agent<br/>Python]
    G[S3 Storage]
  end

  subgraph EXT["External Services"]
    direction TB
    H[OpenAI GPT]
    I[Deepgram Speech-to-Text]
    J[ElevenLabs Text-to-Speech]
  end

  %% Connections with concise labels from your story
  A -->|campaigns & responses| D
  A -->|admin actions| E
  B -->|WebRTC media| C
  B -->|store results| D

  C -->|room events| F
  F -->|read/write| D
  F -->|invoke| E
  F -->|store media| G
  F -->|LLM calls| H
  F -->|STT| I
  F -->|TTS| J

  %% Styles (category colors)
  classDef app fill:#E3F2FD,stroke:#1E88E5,color:#0D47A1,stroke-width:1px;
  classDef infra fill:#FFF3E0,stroke:#FB8C00,color:#E65100,stroke-width:1px;
  classDef backend fill:#E8F5E9,stroke:#43A047,color:#1B5E20,stroke-width:1px;
  classDef external fill:#F3E5F5,stroke:#8E24AA,color:#4A148C,stroke-width:1px;

  class A,B app;
  class C,D,E infra;
  class F,G backend;
  class H,I,J external;

```

## 📱 Frontend Applications

### 1. Survey Hub (Campaign Management)
**Location**: `apps/survey-hub/`
**Purpose**: Admin interface for creating and managing voice survey campaigns

**Key Features**:
- 🔐 **Authentication**: Supabase Auth integration
- 📊 **Campaign Management**: Create, edit, and manage survey campaigns
- ❓ **Question Builder**: Dynamic question creation with ordering
- 📈 **Analytics Dashboard**: Real-time survey completion metrics
- 👥 **Invitation System**: Generate unique links for participants
- 📋 **Response Management**: View and export survey responses

**Tech Stack**:
- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- React Query for data fetching
- React Router for navigation

### 2. Live Chatter (Voice Participation)
**Location**: `apps/live-chatter/`
**Purpose**: Voice interface for survey participants

**Key Features**:
- 🎤 **Voice Interface**: Real-time voice conversation with AI
- 🔗 **Campaign Links**: Join via unique survey links
- 📱 **Mobile Optimized**: Responsive design for mobile devices
- 🎧 **Audio Controls**: Mute, volume, and connection status
- 📊 **Progress Tracking**: Visual survey completion progress
- 🔄 **Session Management**: Resume interrupted surveys

**Tech Stack**:
- React + TypeScript + Vite
- LiveKit Web SDK
- Tailwind CSS + shadcn/ui
- React Query for state management

## ☁️ Cloud Infrastructure

### 1. LiveKit Cloud
**Purpose**: Real-time communication infrastructure

**Key Components**:
- **Room Management**: Dynamic room creation for each survey session
- **WebRTC Signaling**: Handles real-time audio/video streaming
- **Connection Management**: Manages participant connections
- **Agent Integration**: Routes calls to Python agents

**Configuration**:
```typescript
// apps/live-chatter/src/config/livekit.ts
export const LIVEKIT_CONFIG = {
  url: process.env.VITE_LIVEKIT_URL,
  apiKey: process.env.VITE_LIVEKIT_API_KEY,
  apiSecret: process.env.VITE_LIVEKIT_API_SECRET
}
```

### 2. Supabase Database
**Purpose**: Centralized data storage and management

**Core Tables**:
```sql
-- Campaign Management
campaign (
  id, name, intro_prompt, greeting, 
  purpose_explanation, campaign_uri, 
  created_at, updated_at
)

-- Survey Questions
question (
  id, campaign_id, question_text, 
  question_order, question_type, 
  created_at
)

-- Survey Submissions
survey_submissions (
  id, campaign_id, room_name, 
  user_profile_id, status, s3_recording_url,
  started_at, completed_at, created_at
)

-- Survey Answers
survey_answers (
  id, submission_id, question_id, 
  answer_text, answer_audio_url, 
  created_at
)

-- Campaign Links & Invitations
campaign_links (
  id, campaign_id, link_token, 
  is_anonymous, max_uses, used_count,
  expires_at, created_at
)

-- Room Pattern Mapping
campaign_room_mapping (
  id, campaign_id, room_pattern, 
  is_active, created_at
)
```

### 3. Supabase Edge Functions
**Purpose**: Serverless API endpoints for data operations

**Key Endpoints**:
```typescript
// Campaign Management
GET /campaigns/{campaign_uri}/details?token={link_token}
POST /campaigns
PUT /campaigns/{id}

// Survey Submissions
POST /submissions
GET /submissions?room_name={room_name}
PUT /submissions/{id}

// Survey Answers
POST /submissions/{id}/answers
GET /submissions/{id}/answers

// Analytics
GET /analytics/campaign/{id}
GET /analytics/overview
```

## 🤖 Backend Services

### 1. LiveKit Agent (Python)
**Location**: `services/livekit-agent/`
**Deployment**: Digital Ocean VM
**Purpose**: AI-powered voice conversation agent

**Key Features**:
- 🧠 **Dynamic Prompting**: Loads campaign-specific prompts and questions
- 🎯 **Campaign Routing**: Routes calls based on room name patterns
- 💾 **Data Persistence**: Saves responses via API calls
- 🎙️ **Audio Processing**: Handles speech-to-text and text-to-speech
- 📹 **Recording**: Automatic call recording to S3
- 🔄 **Session Management**: Handles multiple concurrent sessions

**Core Components**:
```python
# services/livekit-agent/main.py
class SurveyAgent(Agent):
    async def on_connect(self, session: AgentSession):
        # Load campaign data based on room name
        # Initialize conversation flow
        
    async def on_message(self, message: str):
        # Process user input
        # Generate AI response
        # Save answers to database
        
    async def on_disconnect(self):
        # Finalize survey submission
        # Upload recording to S3
```

**API Integration**:
```python
# services/livekit-agent/api_client.py
class SurveyAPIClient:
    async def get_campaign_details(self, campaign_uri: str, token: str)
    async def create_submission(self, campaign_id: int, room_name: str)
    async def save_answer(self, submission_id: int, question_id: int, answer: str)
    async def update_submission(self, submission_id: int, s3_url: str)
```

### 2. S3 Storage
**Purpose**: Audio recording and file storage

**Storage Structure**:
```
s3://voice-surveys/
├── recordings/
│   ├── campaign-1/
│   │   ├── room-123-2024-01-15.mp3
│   │   └── room-456-2024-01-15.mp3
│   └── campaign-2/
│       └── room-789-2024-01-15.mp3
└── audio-snippets/
    ├── answers/
    └── prompts/
```

## 🔄 Data Flow

### 1. Campaign Creation Flow
```mermaid
sequenceDiagram
    participant Admin as Survey Hub
    participant API as Supabase Edge Functions
    participant DB as Supabase Database
    
    Admin->>API: POST /campaigns
    API->>DB: Insert campaign data
    DB-->>API: Campaign created
    API-->>Admin: Campaign details
    
    Admin->>API: POST /campaigns/{id}/questions
    API->>DB: Insert questions
    DB-->>API: Questions created
    API-->>Admin: Question details
```

### 2. Survey Participation Flow
```mermaid
sequenceDiagram
    participant User as Live Chatter
    participant LiveKit as LiveKit Cloud
    participant Agent as Python Agent
    participant API as Supabase Edge Functions
    participant DB as Supabase Database
    
    User->>LiveKit: Join room (via survey link)
    LiveKit->>Agent: Agent connects to room
    Agent->>API: GET /campaigns/{uri}/details
    API->>DB: Fetch campaign & questions
    DB-->>API: Campaign data
    API-->>Agent: Campaign details
    
    Agent->>API: POST /submissions
    API->>DB: Create submission
    DB-->>API: Submission created
    
    loop Survey Questions
        Agent->>User: Ask question
        User->>Agent: Voice response
        Agent->>API: POST /submissions/{id}/answers
        API->>DB: Save answer
    end
    
    Agent->>API: PUT /submissions/{id} (complete)
    API->>DB: Update submission status
```

### 3. Analytics Flow
```mermaid
sequenceDiagram
    participant Admin as Survey Hub
    participant API as Supabase Edge Functions
    participant DB as Supabase Database
    
    Admin->>API: GET /analytics/campaign/{id}
    API->>DB: Query submission data
    DB-->>API: Analytics data
    API-->>Admin: Formatted analytics
```

## 🔧 Configuration & Environment

### Environment Variables
```bash
# LiveKit Configuration
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI Configuration
OPENAI_API_KEY=your_openai_key

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=voice-surveys

# Deepgram Configuration
DEEPGRAM_API_KEY=your_deepgram_key

# ElevenLabs Configuration
ELEVENLABS_API_KEY=your_elevenlabs_key
```

## 🚀 Deployment Architecture

### Production Setup
```mermaid
graph TB
    subgraph "CDN & Load Balancer"
        A[Cloudflare/Vercel]
    end
    
    subgraph "Frontend Hosting"
        B[Survey Hub - Vercel]
        C[Live Chatter - Vercel]
    end
    
    subgraph "Backend Infrastructure"
        D[LiveKit Cloud]
        E[Supabase Cloud]
        F[Python Agent - Digital Ocean VM]
        G[S3 Storage]
    end
    
    A --> B
    A --> C
    B --> E
    C --> D
    D --> F
    F --> E
    F --> G
    
    style A fill:#ffeb3b
    style B fill:#e1f5fe
    style C fill:#e1f5fe
    style D fill:#fff3e0
    style E fill:#f3e5f5
    style F fill:#e8f5e8
    style G fill:#e8f5e8
```

## 📊 Monitoring & Analytics

### Key Metrics
- **Survey Completion Rate**: Percentage of started surveys that are completed
- **Average Session Duration**: Time spent in voice conversations
- **Question Response Rate**: Percentage of questions answered
- **Agent Performance**: Response time and accuracy metrics
- **System Uptime**: LiveKit and agent availability

### Logging Strategy
```python
# services/livekit-agent/main.py
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('survey_agent.log')
    ]
)
```

## 🔒 Security Considerations

### Authentication & Authorization
- **Supabase Auth**: JWT-based authentication for admin users
- **API Security**: Service role keys for agent-to-API communication
- **Room Security**: LiveKit room tokens with expiration
- **Data Encryption**: All data encrypted in transit and at rest

### Data Privacy
- **GDPR Compliance**: User consent and data deletion capabilities
- **PII Protection**: Sensitive data encryption and anonymization
- **Audit Logging**: Complete audit trail of all data operations
- **Access Controls**: Role-based access to survey data

## 🎯 Next Steps & Roadmap

### Phase 1: Core Implementation ✅
- [x] Basic LiveKit integration
- [x] Python agent with OpenAI integration
- [x] Supabase database schema
- [x] Basic React frontends

### Phase 2: Enhanced Features 🚧
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Custom voice models
- [ ] Survey templates

### Phase 3: Scale & Optimize 📋
- [ ] Multi-region deployment
- [ ] Advanced caching strategies
- [ ] Real-time collaboration features
- [ ] Mobile app development

## 📚 Documentation & Resources

- **API Documentation**: `/docs/api-reference.md`
- **Deployment Guide**: `/docs/deployment.md`
- **Development Setup**: `/docs/development.md`
- **Troubleshooting**: `/docs/troubleshooting.md`

---

This architecture provides a scalable, secure, and user-friendly voice survey platform that can handle multiple campaigns, concurrent users, and provides comprehensive analytics for survey creators.
