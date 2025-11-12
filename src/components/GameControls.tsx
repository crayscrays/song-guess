import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface GameControlsProps {
  onNextRound: () => void;
  onRestart: () => void;
  showNextRound: boolean;
  showRestart: boolean;
  nextLabel?: string;
  restartLabel?: string;
}

export const GameControls = ({
  onNextRound,
  onRestart,
  showNextRound,
  showRestart,
  nextLabel,
  restartLabel,
}: GameControlsProps) => {
  if (!showRestart) return null;

  const restartText = restartLabel ?? "Try Again";

  return (
    <div className="w-full max-w-2xl mx-auto flex justify-center">
      <Button
        onClick={onRestart}
        variant="outline"
        className="flex-1 h-8 md:h-12 gap-1 md:gap-2 max-w-xs text-xs md:text-sm"
      >
        <RotateCcw className="w-3 h-3 md:w-4 md:h-4" />
        {restartText}
      </Button>
    </div>
  );
};
