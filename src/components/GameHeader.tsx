interface GameHeaderProps {
  currentSongNumber: number;
  totalSongs: number;
  isDailyComplete: boolean;
}

export const GameHeader = ({
  currentSongNumber,
  totalSongs,
  isDailyComplete,
}: GameHeaderProps) => {
  return (
    <header className="w-full max-w-2xl mx-auto">
      <div className="flex flex-col items-center gap-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Song Guess</h1>
          <p className="text-sm text-muted-foreground">Guess the song!</p>
        </div>
      </div>
    </header>
  );
};
