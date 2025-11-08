# Teacher Hub - AI-Powered Voice Learning Platform

A comprehensive monorepo for creating interactive voice-based lessons with real-time audio processing, lesson management, and student performance analytics.

## 🎯 Project Objective

Teacher Hub is a modern learning platform that enables educators to create and deliver interactive voice-based lessons using AI agents. The system combines real-time audio processing, intelligent conversation management, quiz evaluation, and comprehensive analytics to deliver engaging educational experiences.

### Key Features
- **AI Voice Teachers**: Intelligent teaching agents that can conduct natural educational conversations
- **Lesson Management**: Create and manage multiple lessons with questions and quizzes
- **Real-time Audio Processing**: LiveKit-powered audio rooms for seamless voice interactions
- **Quiz Evaluation**: Automatic grading and feedback for quiz questions
- **Student Performance Tracking**: Detailed insights and performance analytics
- **Modern Web Interface**: Beautiful, responsive dashboards for lesson management

## 🏗️ Monorepo Architecture

This project uses a monorepo structure with npm workspaces for frontend applications and Docker for backend services.

```
voice-surveys/
├── apps/                          # Frontend Applications
│   ├── live-chatter/             # Real-time audio chat interface for students
│   └── teacher-hub/               # Lesson management & analytics dashboard
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
**Real-time audio lesson interface**

- **Purpose**: Provides the voice interaction interface for students taking lessons
- **Tech Stack**: React + TypeScript + Vite + LiveKit
- **Features**:
  - Real-time audio rooms for voice conversations
  - AI teacher agent integration for natural lesson flow
  - Student management and room status
  - Lesson link management
  - Mobile-responsive design
  - Real-time progress tracking

### 📚 Teacher Hub (`apps/teacher-hub/`)
**Lesson management and analytics dashboard**

- **Purpose**: Administrative interface for teachers to create and manage lessons
- **Tech Stack**: React + TypeScript + Vite + Supabase
- **Features**:
  - Lesson creation and management
  - Question and quiz design with correct answers
  - Student performance tracking and analytics
  - Student management
  - Lesson link generation and sharing
  - Real-time dashboard updates
  - Performance metrics and scoring

## 🔧 Backend Services

### 🤖 LiveKit Agent (`services/livekit-agent/`)
**Python-based AI teaching agent**

- **Purpose**: Handles real-time audio processing and AI conversation management for lessons
- **Tech Stack**: Python + LiveKit + Docker
- **Features**:
  - Multi-lesson support with dynamic loading
  - Room-based lesson routing
  - API integration with Supabase
  - Quiz question evaluation and scoring
  - Automatic feedback generation
  - Scalable containerized deployment
  - Real-time audio processing
  - Student performance tracking

## 📦 Shared Packages

### 🔗 Shared Core (`packages/shared/`)
**Cross-application utilities and types**

- **Purpose**: Provides shared TypeScript types, schemas, and utilities
- **Contents**:
  - LiveKit type definitions
  - Supabase database types
  - Lesson submission schemas
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
   cp apps/teacher-hub/.env.example apps/teacher-hub/.env
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
   npm run dev:teacher-hub
   ```

## 📋 Available Scripts

### Development
- `npm run dev:live-chatter` - Start Live Chatter development server
- `npm run dev:teacher-hub` - Start Teacher Hub development server
- `npm run dev:agent` - Start LiveKit agent with Docker
- `npm run dev:db` - Start Supabase local development
- `npm run dev:api` - Serve Supabase edge functions

### Building
- `npm run build:live-chatter` - Build Live Chatter for production
- `npm run build:teacher-hub` - Build Teacher Hub for production

### Utilities
- `npm run typecheck` - Run TypeScript type checking across all packages
- `npm run lint` - Run linting across all packages
- `npm run test` - Run tests across all packages
- `npm run db:types` - Generate TypeScript types from Supabase schema

## 🏛️ Architecture Overview

### Data Flow
1. **Lesson Creation**: Teachers create lessons with questions and quizzes in Teacher Hub
2. **Lesson Sharing**: Lesson links are generated and shared with students
3. **Voice Interaction**: Students join Live Chatter rooms for voice-based lessons
4. **AI Processing**: LiveKit agent processes audio, manages conversation flow, and evaluates quiz answers
5. **Data Storage**: Student responses and performance data are stored in Supabase via API calls
6. **Analytics**: Teacher Hub displays real-time analytics, student performance, and insights

### Technology Stack
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Python, FastAPI, LiveKit
- **Database**: PostgreSQL (Supabase)
- **Real-time**: LiveKit and Supabase real-time for responsive UX
- **Deployment**: Docker containers, Supabase hosting

## 🔐 Security Features

- **Row Level Security**: Database-level access control
- **API Authentication**: Secure API endpoints with proper authorization
- **Environment Variables**: Secure configuration management
- **Input Validation**: Comprehensive data validation across all layers
- **Student Data Protection**: Secure handling of student information and performance data

## 📈 Scalability

- **Containerized Services**: Docker-based deployment for easy scaling
- **API-First Architecture**: RESTful APIs for flexible integration
- **Real-time Capabilities**: LiveKit and Supabase real-time for responsive UX
- **Multi-Lesson Support**: Concurrent lesson delivery
- **Performance Optimization**: Efficient handling of student data and quiz evaluations

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

**Teacher Hub** - Transforming education through AI-powered voice interactions and interactive learning experiences.
