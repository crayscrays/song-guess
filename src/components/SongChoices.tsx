import { Song } from "@/data/songs";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";

interface SongChoicesProps {
  choices: Song[];
  selectedSong: string | null;
  correctSong: string | null;
  onSelect: (songId: string) => void;
  disabled: boolean;
}

export const SongChoices = ({
  choices,
  selectedSong,
  correctSong,
  onSelect,
  disabled,
}: SongChoicesProps) => {
  const getButtonVariant = (songId: string) => {
    if (correctSong === null) return "outline";
    if (songId === correctSong) return "default";
    if (songId === selectedSong && songId !== correctSong) return "destructive";
    return "outline";
  };

  const getButtonIcon = (songId: string) => {
    if (correctSong === null) return null;
    if (songId === correctSong) return <CheckCircle2 className="w-5 h-5" />;
    if (songId === selectedSong && songId !== correctSong)
      return <XCircle className="w-5 h-5" />;
    return null;
  };

  if (choices.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      <h2 className="text-lg font-semibold text-foreground mb-4">
        Which song is playing?
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {choices.map((song) => (
          <Button
            key={song.id}
            variant={getButtonVariant(song.id)}
            onClick={() => onSelect(song.id)}
            disabled={disabled || correctSong !== null}
            className="h-auto py-4 px-6 justify-start gap-3 text-left transition-all hover:scale-[1.02]"
          >
            <div className="flex-1">
              <p className="font-semibold">{song.titleChinese}</p>
              <p className="text-xs opacity-80">{song.title}</p>
            </div>
            {getButtonIcon(song.id)}
          </Button>
        ))}
      </div>
    </div>
  );
};
