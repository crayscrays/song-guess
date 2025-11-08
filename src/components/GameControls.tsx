import { Button } from "@/components/ui/button";
import { RotateCcw, Play } from "lucide-react";

interface GameControlsProps {
  onNextRound: () => void;
  onRestart: () => void;
  showNextRound: boolean;
  showRestart: boolean;
}

export const GameControls = ({
  onNextRound,
  onRestart,
  showNextRound,
  showRestart,
}: GameControlsProps) => {
  if (!showNextRound && !showRestart) return null;

  return (
    <div className="w-full max-w-2xl mx-auto flex gap-4">
      {showNextRound && (
        <Button
          onClick={onNextRound}
          className="flex-1 h-12 bg-gradient-primary hover:opacity-90 gap-2"
        >
          <Play className="w-4 h-4" />
          Next Round
        </Button>
      )}
      {showRestart && (
        <Button
          onClick={onRestart}
          variant="outline"
          className="flex-1 h-12 gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Try Again
        </Button>
      )}
    </div>
  );
};
