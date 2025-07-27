import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AudioRoom } from '@/components/audio/AudioRoom';
import { SimpleSurvey } from '@/components/audio/SimpleSurvey';
import { Headphones, Users, Mic, Zap, Bot, ArrowRight } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<'home' | 'room' | 'survey'>('home');
  const [roomName, setRoomName] = useState('');
  const [userName, setUserName] = useState('');

  const handleQuickJoin = () => {
    const params = new URLSearchParams({
      room: roomName || 'demo-room',
      user: userName || `User-${Math.floor(Math.random() * 1000)}`,
      autoJoin: 'true'
    });
    navigate(`/room?${params.toString()}`);
  };

  if (currentView === 'room') {
    return <AudioRoom onLeave={() => setCurrentView('home')} />;
  }

  if (currentView === 'survey') {
    return <SimpleSurvey onComplete={() => setCurrentView('home')} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-primary opacity-5" />
        <div className="relative max-w-6xl mx-auto px-4 py-20">
          <div className="text-center space-y-8">
            <div className="mx-auto h-20 w-20 bg-gradient-primary rounded-full flex items-center justify-center mb-8 shadow-glow">
              <Headphones className="h-10 w-10 text-white" />
            </div>
            
            <h1 className="text-6xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              LiveKit Audio
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              High-quality, low-latency audio conversations. Connect with your team, 
              friends, or community with crystal-clear sound.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-lg mx-auto">
              <Button
                onClick={() => setCurrentView('survey')}
                size="lg"
                variant="audio"
                className="w-full sm:w-auto"
              >
                <Bot className="mr-2 h-5 w-5" />
                Start Survey
              </Button>
              
              <Button
                onClick={() => setCurrentView('room')}
                size="lg"
                variant="outline"
                className="w-full sm:w-auto"
              >
                <Users className="mr-2 h-5 w-5" />
                Join Room
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="p-6 text-center space-y-4 hover:shadow-primary transition-all duration-300">
            <div className="mx-auto h-12 w-12 bg-audio-success rounded-full flex items-center justify-center">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold">Low Latency</h3>
            <p className="text-muted-foreground">
              Ultra-low latency audio streaming for real-time conversations without delay.
            </p>
          </Card>

          <Card className="p-6 text-center space-y-4 hover:shadow-primary transition-all duration-300">
            <div className="mx-auto h-12 w-12 bg-audio-primary rounded-full flex items-center justify-center">
              <Mic className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold">Crystal Clear</h3>
            <p className="text-muted-foreground">
              Advanced audio processing ensures your voice comes through clearly every time.
            </p>
          </Card>

          <Card className="p-6 text-center space-y-4 hover:shadow-primary transition-all duration-300">
            <div className="mx-auto h-12 w-12 bg-audio-speaking rounded-full flex items-center justify-center">
              <Users className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold">Multi-User</h3>
            <p className="text-muted-foreground">
              Support for multiple participants with speaking indicators and audio controls.
            </p>
          </Card>
        </div>
      </div>

      {/* Quick Join Section */}
      <div className="max-w-2xl mx-auto px-4 pb-20">
        <Card className="p-8">
          <h2 className="text-2xl font-bold text-center mb-6">Join a Room</h2>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="roomName">Room Name</Label>
                <Input
                  id="roomName"
                  placeholder="Enter room name"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="userName">Your Name</Label>
                <Input
                  id="userName"
                  placeholder="Enter your name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                />
              </div>
            </div>

            <Button
              onClick={handleQuickJoin}
              variant="audio"
              size="lg"
              className="w-full"
            >
              Join Room
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Index;
