import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ParticipantInfo } from "@/hooks/useLiveKit";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ParticipantListProps {
  participants: ParticipantInfo[];
  className?: string;
}

export function ParticipantList({ participants, className }: ParticipantListProps) {
  if (participants.length === 0) {
    return (
      <Card className={cn("p-6 text-center", className)}>
        <p className="text-muted-foreground">No participants in the room</p>
      </Card>
    );
  }

  return (
    <Card className={cn("p-4", className)}>
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Volume2 className="h-5 w-5" />
        Participants ({participants.length})
      </h3>
      
      <div className="space-y-3">
        {participants.map((participantInfo) => {
          const { participant, isSpeaking, audioEnabled } = participantInfo;
          const isLocal = participant.isLocal;
          
          return (
            <div
              key={participant.identity}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg transition-all duration-300",
                isSpeaking 
                  ? "bg-gradient-speaking/10 ring-2 ring-audio-speaking shadow-speaking" 
                  : "bg-secondary/50 hover:bg-secondary"
              )}
            >
              <div className="relative">
                <Avatar className={cn(
                  "h-10 w-10 transition-all duration-300",
                  isSpeaking && "ring-2 ring-audio-speaking shadow-glow"
                )}>
                  <AvatarFallback className={cn(
                    "text-sm font-medium",
                    isSpeaking 
                      ? "bg-gradient-speaking text-white" 
                      : "bg-primary text-primary-foreground"
                  )}>
                    {participant.identity?.slice(0, 2).toUpperCase() || "??"}
                  </AvatarFallback>
                </Avatar>
                
                {isSpeaking && (
                  <div className="absolute -top-1 -right-1 h-4 w-4 bg-audio-speaking rounded-full animate-pulse" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={cn(
                    "font-medium truncate",
                    isSpeaking && "text-audio-speaking"
                  )}>
                    {participant.identity}
                  </p>
                  {isLocal && (
                    <Badge variant="secondary" className="text-xs">
                      You
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-2 mt-1">
                  {audioEnabled ? (
                    <Mic className={cn(
                      "h-3 w-3",
                      isSpeaking ? "text-audio-speaking" : "text-audio-success"
                    )} />
                  ) : (
                    <MicOff className="h-3 w-3 text-audio-muted" />
                  )}
                  <span className={cn(
                    "text-xs",
                    isSpeaking 
                      ? "text-audio-speaking font-medium" 
                      : audioEnabled 
                        ? "text-audio-success"
                        : "text-audio-muted"
                  )}>
                    {isSpeaking ? "Speaking" : audioEnabled ? "Listening" : "Muted"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}