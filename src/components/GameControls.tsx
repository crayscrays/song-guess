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
    <div className="w-full max-w-2xl mx-auto flex justify-center mt-2">
      <Button
        onClick={onRestart}
        variant="outline"
        className="flex-1 h-10 gap-2 max-w-xs"
      >
        <RotateCcw className="w-4 h-4" />
        {restartText}
      </Button>
    </div>
  );
};
