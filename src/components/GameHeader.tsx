import { Music } from "lucide-react";

interface GameHeaderProps {
  score: number;
}

export const GameHeader = ({ score }: GameHeaderProps) => {
  return (
    <header className="w-full max-w-2xl mx-auto mb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-primary rounded-xl">
            <Music className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Jay Chou Quiz</h1>
            <p className="text-sm text-muted-foreground">Guess the song!</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl px-6 py-3">
          <p className="text-sm text-muted-foreground">Score</p>
          <p className="text-2xl font-bold text-foreground">{score}</p>
        </div>
      </div>
    </header>
  );
};
