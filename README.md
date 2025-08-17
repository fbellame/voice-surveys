# Voice Surveys - AI-Powered Voice Survey Platform

A comprehensive monorepo for conducting AI-powered voice surveys with real-time audio processing, campaign management, and analytics.

## 🎯 Project Objective

Voice Surveys is a modern platform that enables organizations to conduct interactive voice surveys using AI agents. The system combines real-time audio processing, intelligent conversation management, and comprehensive analytics to deliver engaging survey experiences.

### Key Features
- **AI Voice Agents**: Intelligent survey agents that can conduct natural conversations
- **Multi-Campaign Support**: Manage multiple survey campaigns simultaneously
- **Real-time Audio Processing**: LiveKit-powered audio rooms for seamless voice interactions
- **Anonymous Surveys**: Support for generic links without user registration
- **Comprehensive Analytics**: Detailed insights and response tracking
- **Modern Web Interface**: Beautiful, responsive dashboards for campaign management

## 🏗️ Monorepo Architecture

This project uses a monorepo structure with npm workspaces for frontend applications and Docker for backend services.

```
voice-surveys/
├── apps/                          # Frontend Applications
│   ├── live-chatter/             # Real-time audio chat interface
│   └── survey-hub/               # Campaign management & analytics dashboard
├── services/                      # Backend Services
│   └── livekit-agent/            # Python LiveKit agent (containerized)
├── packages/                      # Shared Packages
│   └── shared/                   # Shared TypeScript types & utilities
├── supabase/                     # Database & Edge Functions
│   ├── migrations/               # SQL migrations
│   ├── functions/                # Deno edge functions
│   └── config.toml              # Supabase configuration
└── docs/                         # Documentation
```

## 📱 Applications

### 🎤 Live Chatter (`apps/live-chatter/`)
**Real-time audio survey interface**

- **Purpose**: Provides the voice interaction interface for survey participants
- **Tech Stack**: React + TypeScript + Vite + LiveKit
- **Features**:
  - Real-time audio rooms for voice conversations
  - AI agent integration for natural survey flow
  - Participant management and room status
  - Campaign link management
  - Mobile-responsive design

### 📊 Survey Hub (`apps/survey-hub/`)
**Campaign management and analytics dashboard**

- **Purpose**: Administrative interface for creating and managing survey campaigns
- **Tech Stack**: React + TypeScript + Vite + Supabase
- **Features**:
  - Campaign creation and management
  - Question bank and survey design
  - Analytics and response tracking
  - User management and invitations
  - Anonymous survey support
  - Real-time dashboard updates

## 🔧 Backend Services

### 🤖 LiveKit Agent (`services/livekit-agent/`)
**Python-based AI survey agent**

- **Purpose**: Handles real-time audio processing and AI conversation management
- **Tech Stack**: Python + LiveKit + Docker
- **Features**:
  - Multi-campaign support with dynamic loading
  - Room-based campaign routing
  - API integration with Supabase
  - Anonymous survey support
  - Scalable containerized deployment
  - Real-time audio processing

## 📦 Shared Packages

### 🔗 Shared Core (`packages/shared/`)
**Cross-application utilities and types**

- **Purpose**: Provides shared TypeScript types, schemas, and utilities
- **Contents**:
  - LiveKit type definitions
  - Supabase database types
  - Survey submission schemas
  - Common utility functions

## 🗄️ Database & Infrastructure

### 🚀 Supabase (`supabase/`)
**Backend-as-a-Service with PostgreSQL**

- **Purpose**: Provides database, authentication, and edge functions
- **Features**:
  - PostgreSQL database with real-time subscriptions
  - Row Level Security (RLS) policies
  - Edge functions for API endpoints
  - Built-in authentication
  - File storage capabilities

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Docker and Docker Compose
- Supabase CLI

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd voice-surveys
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Copy example environment files
   cp apps/live-chatter/.env.example apps/live-chatter/.env
   cp apps/survey-hub/.env.example apps/survey-hub/.env
   cp services/livekit-agent/.env.example services/livekit-agent/.env
   ```

4. **Start the development environment**
   ```bash
   # Start Supabase local development
   npm run dev:db
   
   # Start the LiveKit agent
   npm run dev:agent
   
   # Start frontend applications (in separate terminals)
   npm run dev:live-chatter
   npm run dev:survey-hub
   ```

## 📋 Available Scripts

### Development
- `npm run dev:live-chatter` - Start Live Chatter development server
- `npm run dev:survey-hub` - Start Survey Hub development server
- `npm run dev:agent` - Start LiveKit agent with Docker
- `npm run dev:db` - Start Supabase local development
- `npm run dev:api` - Serve Supabase edge functions

### Building
- `npm run build:live-chatter` - Build Live Chatter for production
- `npm run build:survey-hub` - Build Survey Hub for production

### Utilities
- `npm run typecheck` - Run TypeScript type checking across all packages
- `npm run lint` - Run linting across all packages
- `npm run test` - Run tests across all packages
- `npm run db:types` - Generate TypeScript types from Supabase schema

## 🏛️ Architecture Overview

### Data Flow
1. **Campaign Creation**: Admin creates survey campaigns in Survey Hub
2. **Participant Invitation**: Survey links are generated and shared with participants
3. **Voice Interaction**: Participants join Live Chatter rooms for voice surveys
4. **AI Processing**: LiveKit agent processes audio and manages conversation flow
5. **Data Storage**: Responses are stored in Supabase via API calls
6. **Analytics**: Survey Hub displays real-time analytics and insights

### Technology Stack
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Python, FastAPI, LiveKit
- **Database**: PostgreSQL (Supabase)
- **Real-time**: LiveKit and Supabase real-time for responsive UX
- **Deployment**: Docker containers, Supabase hosting

## 🔐 Security Features

- **Row Level Security**: Database-level access control
- **API Authentication**: Secure API endpoints with proper authorization
- **Anonymous Surveys**: Support for generic links without user registration
- **Environment Variables**: Secure configuration management
- **Input Validation**: Comprehensive data validation across all layers

## 📈 Scalability

- **Containerized Services**: Docker-based deployment for easy scaling
- **API-First Architecture**: RESTful APIs for flexible integration
- **Real-time Capabilities**: LiveKit and Supabase real-time for responsive UX
- **Multi-Campaign Support**: Concurrent survey campaigns
- **Anonymous Mode**: Reduced database load for public surveys

## 🤝 Contributing

1. Follow the established monorepo structure
2. Use the provided cursor rules for consistent code style
3. Write tests for new features
4. Update documentation for API changes
5. Follow the commit message conventions

## 📄 License

[Add your license information here]

## 🆘 Support

For questions and support:
- Check the documentation in the `docs/` directory
- Review the monorepo strategy document
- Open an issue for bugs or feature requests

---

**Voice Surveys** - Transforming survey experiences through AI-powered voice interactions.
