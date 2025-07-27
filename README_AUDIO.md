# LiveKit Audio App

A beautiful, responsive audio-only application built with React + Vite and LiveKit Cloud. Features real-time audio communication with multiple participants, speaking indicators, and intuitive controls.

## Features

- 🎵 **Audio-only communication** - No video, just crystal-clear audio
- 🚀 **Auto-join functionality** - Quick access to audio rooms
- 🎤 **Mute/unmute controls** - Easy microphone management
- 👥 **Participant list** - See who's connected and speaking
- 📢 **Speaking indicators** - Visual feedback for active speakers
- 📱 **Mobile responsive** - Works seamlessly on desktop and mobile
- 🎨 **Beautiful UI** - Modern design with gradients and animations

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom design system
- **Audio**: LiveKit Client SDK v2.9.5
- **Components**: Custom components with shadcn/ui base
- **State Management**: React hooks with custom LiveKit integration

## Project Structure

```
src/
├── components/
│   ├── audio/
│   │   ├── AudioRoom.tsx        # Main room component
│   │   ├── ParticipantList.tsx  # Shows connected users
│   │   ├── AudioControls.tsx    # Mute/unmute controls
│   │   └── RoomStatus.tsx       # Connection status display
│   └── ui/                      # Reusable UI components
├── hooks/
│   └── useLiveKit.ts           # Custom LiveKit hook
├── utils/
│   └── token.ts                # JWT token generation
├── config/
│   └── livekit.ts              # LiveKit configuration
└── pages/
    ├── Index.tsx               # Landing page
    └── Room.tsx                # Room page with URL params
```

## Usage

### Landing Page
- Beautiful hero section with feature highlights
- Quick start button for immediate room access
- Custom room/username entry form
- Demo room quick access

### Audio Room
- **Join Room**: Enter room name and username
- **Audio Controls**: Large, accessible mute/unmute button
- **Participant List**: Real-time list with speaking indicators
- **Status Display**: Connection status and participant count
- **Leave Room**: Easy exit with confirmation

### URL Parameters
You can directly join rooms using URL parameters:
- `/room?room=my-room&user=john&autoJoin=true`

## Configuration

The app uses the provided LiveKit Cloud configuration:
- **API Key**: `APIRqZKknBp4ony`
- **API Secret**: `REDACTED_SECRET`
- **WebSocket URL**: `wss://alex-6mb80ejp.livekit.cloud`

## Design System

The app features a cohesive design system with:
- **Primary Colors**: Purple gradients for main actions
- **Success Colors**: Green for connected/listening states  
- **Speaking Colors**: Orange for active speakers
- **Custom Shadows**: Subtle glows and depth
- **Smooth Animations**: Transitions and hover effects
- **Semantic Tokens**: All colors defined in CSS variables

## Development Notes

- Built for Lovable (React + Vite, not Next.js)
- Uses LiveKit Server SDK for secure token generation
- Modular component architecture for easy extension
- Mobile-first responsive design
- Accessible UI with proper ARIA labels
- Error handling with toast notifications

## Running Locally

1. Clone the repository
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`
4. Open `http://localhost:8080`

The app will automatically use the configured LiveKit Cloud instance.

## Security Notes

- API keys are included for demo purposes
- In production, token generation should be moved to backend
- Consider implementing user authentication
- Add rate limiting for room creation

## Browser Support

- Chrome 88+ (recommended)
- Firefox 84+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

Requires microphone permissions for audio functionality.