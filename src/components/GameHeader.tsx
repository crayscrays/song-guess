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
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <header className="w-full max-w-2xl mx-auto">
      <div className="flex flex-col items-center gap-1 md:gap-4">
        <div className="text-center">
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Song Guess</h1>
          <p className="text-xs md:text-sm text-muted-foreground">{dateStr}</p>
        </div>
      </div>
    </header>
  );
};
