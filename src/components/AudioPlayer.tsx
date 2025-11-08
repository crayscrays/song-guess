import { Play, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AudioPlayerProps {
  attempt: number;
  onPlay: () => void;
  isPlaying: boolean;
}

export const AudioPlayer = ({ attempt, onPlay, isPlaying }: AudioPlayerProps) => {
  const duration = attempt;
  
  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      <div className="bg-card border border-border rounded-2xl p-8">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-primary rounded-full blur-2xl opacity-30 animate-pulse" />
            <Button
              onClick={onPlay}
              disabled={isPlaying}
              size="lg"
              className="relative w-24 h-24 rounded-full bg-gradient-primary hover:opacity-90 transition-all shadow-lg disabled:opacity-50"
            >
              <Play className="w-10 h-10 text-primary-foreground fill-current ml-1" />
            </Button>
          </div>
          
          <div className="text-center space-y-2">
            <div className="flex items-center gap-2 justify-center text-muted-foreground">
              <Volume2 className="w-4 h-4" />
              <span className="text-sm">Play {duration} second{duration > 1 ? 's' : ''}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Attempt {attempt} of 3
            </p>
          </div>
          
          {/* Waveform visualization */}
          <div className="flex items-center gap-1 h-12">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="w-1 bg-primary rounded-full transition-all"
                style={{
                  height: `${Math.random() * 100}%`,
                  opacity: isPlaying ? 1 : 0.3,
                  animation: isPlaying ? `pulse ${0.5 + Math.random()}s ease-in-out infinite` : 'none',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
