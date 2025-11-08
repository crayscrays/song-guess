import { useEffect } from "react";
import { GameHeader } from "@/components/GameHeader";
import { AudioPlayer } from "@/components/AudioPlayer";
import { SongChoices } from "@/components/SongChoices";
import { GameControls } from "@/components/GameControls";
import { useGameState } from "@/hooks/useGameState";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const {
    score,
    attempt,
    gameState,
    currentSong,
    choices,
    selectedSong,
    isPlaying,
    handleGuess,
    handlePlayAudio,
    nextRound,
    restart,
  } = useGameState();

  const { toast } = useToast();

  useEffect(() => {
    if (gameState === "correct") {
      toast({
        title: "🎉 Correct!",
        description: `You guessed ${currentSong.titleChinese} in ${attempt} attempt${attempt > 1 ? 's' : ''}!`,
        variant: "default",
      });
    } else if (gameState === "failed") {
      toast({
        title: "😔 Game Over",
        description: `The correct answer was ${currentSong.titleChinese}`,
        variant: "destructive",
      });
    }
  }, [gameState, currentSong, attempt, toast]);

  return (
    <>
      {/* Hidden YouTube player container */}
      <div id="youtube-player" style={{ display: 'none' }} />
      
      <div className="min-h-screen bg-gradient-bg p-4 md:p-8">
        <div className="max-w-4xl mx-auto pt-8">
          <GameHeader score={score} />

          <div className="mb-8 text-center">
            <p className="text-muted-foreground text-sm">
              {gameState === "playing" && attempt > 1 && "Try again with more time!"}
              {gameState === "correct" && "Amazing! Ready for the next challenge?"}
              {gameState === "failed" && "Don't give up! Try another song."}
            </p>
          </div>

          <AudioPlayer
            attempt={attempt}
            onPlay={handlePlayAudio}
            isPlaying={isPlaying}
          />

          <SongChoices
            choices={choices}
            selectedSong={selectedSong}
            correctSong={gameState !== "playing" ? currentSong.id : null}
            onSelect={handleGuess}
            disabled={isPlaying}
          />

          <GameControls
            onNextRound={nextRound}
            onRestart={restart}
            showNextRound={gameState === "correct"}
            showRestart={gameState === "failed"}
          />

          {/* Instructions */}
          <div className="mt-12 text-center max-w-md mx-auto">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Add YouTube video IDs to your songs to play real audio clips!
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Index;
