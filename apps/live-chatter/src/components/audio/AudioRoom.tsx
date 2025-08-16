import { useState, useEffect } from 'react';
import { useLiveKit } from '@/hooks/useLiveKit';
import { generateToken } from '@/utils/token';
import { ParticipantList } from './ParticipantList';
import { AudioControls } from './AudioControls';
import { RoomStatus } from './RoomStatus';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEFAULT_ROOM_NAME } from '@/config/livekit';
import { ArrowLeft, Headphones } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AudioRoomProps {
  onLeave?: () => void;
  autoJoin?: boolean;
  defaultRoomName?: string;
  defaultUserName?: string;
}

export function AudioRoom({ 
  onLeave, 
  autoJoin = false, 
  defaultRoomName = DEFAULT_ROOM_NAME,
  defaultUserName = ''
}: AudioRoomProps) {
  const [roomName, setRoomName] = useState(defaultRoomName);
  const [userName, setUserName] = useState(defaultUserName || `User-${Math.floor(Math.random() * 1000)}`);
  const [showJoinForm, setShowJoinForm] = useState(!autoJoin);
  
  const { toast } = useToast();
  
  const {
    isConnected,
    isConnecting,
    participants,
    isMuted,
    error,
    joinRoom,
    leaveRoom,
    toggleMute,
  } = useLiveKit();

  const handleJoinRoom = async () => {
    if (!roomName.trim() || !userName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both room name and your name.",
        variant: "destructive"
      });
      return;
    }

    try {
      const token = await generateToken(roomName.trim(), userName.trim());
      await joinRoom(roomName.trim(), userName.trim(), token);
      setShowJoinForm(false);
      
      toast({
        title: "Joined Room",
        description: `Successfully joined ${roomName}`,
      });
    } catch (err) {
      console.error('Failed to join room:', err);
      toast({
        title: "Failed to Join Room",
        description: err instanceof Error ? err.message : "Unknown error occurred",
        variant: "destructive"
      });
    }
  };

  const handleLeaveRoom = async () => {
    await leaveRoom();
    setShowJoinForm(true);
    
    toast({
      title: "Left Room",
      description: "You have left the audio room",
    });
    
    if (onLeave) {
      onLeave();
    }
  };

  // Auto-join on mount if specified
  useEffect(() => {
    if (autoJoin && !isConnected && !isConnecting && showJoinForm) {
      handleJoinRoom();
    }
  }, [autoJoin]);

  if (showJoinForm && !isConnected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto h-12 w-12 bg-gradient-primary rounded-full flex items-center justify-center mb-4">
              <Headphones className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Join Audio Room</h1>
            <p className="text-muted-foreground">
              Connect with others in a high-quality audio conversation
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="roomName">Room Name</Label>
              <Input
                id="roomName"
                placeholder="Enter room name"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                disabled={isConnecting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="userName">Your Name</Label>
              <Input
                id="userName"
                placeholder="Enter your name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                disabled={isConnecting}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleJoinRoom();
                  }
                }}
              />
            </div>

            <Button 
              onClick={handleJoinRoom}
              disabled={isConnecting || !roomName.trim() || !userName.trim()}
              className="w-full"
              variant="audio"
              size="lg"
            >
              {isConnecting ? "Joining..." : "Join Room"}
            </Button>

            {onLeave && (
              <Button
                onClick={onLeave}
                variant="outline"
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
          </div>

          {error && (
            <div className="text-center text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {onLeave && (
          <Button
            onClick={onLeave}
            variant="ghost"
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        )}

        <RoomStatus
          isConnected={isConnected}
          isConnecting={isConnecting}
          roomName={roomName}
          participantCount={participants.length}
          error={error}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <AudioControls
              isMuted={isMuted}
              onToggleMute={toggleMute}
              onLeaveRoom={handleLeaveRoom}
              isConnected={isConnected}
            />
          </div>

          <div>
            <ParticipantList
              participants={participants}
              className="h-full min-h-[300px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}