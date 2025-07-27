import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioControlsProps {
  isMuted: boolean;
  onToggleMute: () => void;
  onLeaveRoom: () => void;
  isConnected: boolean;
  className?: string;
}

export function AudioControls({ 
  isMuted, 
  onToggleMute, 
  onLeaveRoom, 
  isConnected,
  className 
}: AudioControlsProps) {
  return (
    <Card className={cn("p-6", className)}>
      <div className="flex items-center justify-center gap-4">
        <Button
          variant={isMuted ? "audio-muted" : "audio-active"}
          size="audio-control"
          onClick={onToggleMute}
          disabled={!isConnected}
          className={cn(
            "transition-all duration-300 hover:scale-105",
            !isConnected && "opacity-50 cursor-not-allowed"
          )}
        >
          {isMuted ? (
            <MicOff className="h-6 w-6" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </Button>
        
        <Button
          variant="destructive"
          size="audio-control"
          onClick={onLeaveRoom}
          disabled={!isConnected}
          className={cn(
            "transition-all duration-300 hover:scale-105",
            !isConnected && "opacity-50 cursor-not-allowed"
          )}
        >
          <PhoneOff className="h-6 w-6" />
        </Button>
      </div>
      
      <div className="mt-4 text-center space-y-1">
        <p className="text-sm font-medium">
          {isMuted ? "Microphone Off" : "Microphone On"}
        </p>
        <p className="text-xs text-muted-foreground">
          {isConnected ? "Connected to room" : "Not connected"}
        </p>
      </div>
    </Card>
  );
}