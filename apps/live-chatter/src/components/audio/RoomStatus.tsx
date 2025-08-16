import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoomStatusProps {
  isConnected: boolean;
  isConnecting: boolean;
  roomName: string;
  participantCount: number;
  error?: string | null;
  className?: string;
}

export function RoomStatus({ 
  isConnected, 
  isConnecting, 
  roomName, 
  participantCount,
  error,
  className 
}: RoomStatusProps) {
  const getStatusBadge = () => {
    if (error) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <WifiOff className="h-3 w-3" />
          Error
        </Badge>
      );
    }
    
    if (isConnecting) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Connecting...
        </Badge>
      );
    }
    
    if (isConnected) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1 bg-audio-success text-white">
          <Wifi className="h-3 w-3" />
          Connected
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <WifiOff className="h-3 w-3" />
        Disconnected
      </Badge>
    );
  };

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">{roomName}</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{participantCount} participant{participantCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
        
        <div className="text-right space-y-2">
          {getStatusBadge()}
        </div>
      </div>
      
      {error && (
        <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive font-medium">Connection Error</p>
          <p className="text-xs text-destructive/80 mt-1">{error}</p>
        </div>
      )}
    </Card>
  );
}