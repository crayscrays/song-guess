import { CheckCircle2, XCircle } from "lucide-react";

interface GameSongOption {
  id: string;
  title: string;
  titleChinese?: string;
  subtitle?: string;
}

interface SongChoicesProps {
  choices: GameSongOption[];
  selectedSong: string | null;
  correctSong: string | null;
  onSelect: (songId: string) => void;
  disabled: boolean;
  disabledChoiceIds: Set<string>;
}

export const SongChoices = ({
  choices,
  selectedSong,
  correctSong,
  onSelect,
  disabled,
  disabledChoiceIds,
}: SongChoicesProps) => {
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
    <div className="w-full">
      <div className="divide-y divide-border rounded-xl border border-border bg-card/60">
        {choices.map((song) => {
          const isPersistedWrong =
            disabledChoiceIds.has(song.id) && song.id !== correctSong;
          const isDisabled =
            disabled ||
            correctSong !== null ||
            disabledChoiceIds.has(song.id);
          const isIncorrectSelection =
            (correctSong !== null && selectedSong === song.id && song.id !== correctSong) ||
            isPersistedWrong;

          return (
            <button
              key={song.id}
              onClick={() => onSelect(song.id)}
              disabled={isDisabled}
              className={`w-full px-4 py-3 flex items-center gap-3 text-left transition ${
                isIncorrectSelection
                  ? "bg-red-500/10 hover:bg-red-500/10 cursor-not-allowed"
                  : "hover:bg-muted/70"
              } ${isDisabled ? "opacity-70 cursor-not-allowed" : ""}`}
            >
              <div
                className={`flex-1 ${
                  isIncorrectSelection ? "text-red-500" : "text-foreground"
                }`}
              >
                <p className="font-semibold">
                  {song.titleChinese ?? song.title}
                </p>
                {(song.subtitle || song.titleChinese) && (
                  <p
                    className={`text-xs ${
                      isIncorrectSelection ? "text-red-400" : "text-muted-foreground"
                    }`}
                  >
                    {song.subtitle ?? song.title}
                  </p>
                )}
              </div>
              {isIncorrectSelection ? (
                <span className="text-lg" role="img" aria-label="Wrong answer">
                  ❌
                </span>
              ) : (
                getButtonIcon(song.id)
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
