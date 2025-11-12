import { Play, Volume2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ThemeGradient } from "@/hooks/useGameState";
import { Button } from "@/components/ui/button";

interface AudioPlayerProps {
  attempt: number;
  maxAttempts: number;
  clipDuration: number | null;
  onPlay: () => void;
  isPlaying: boolean;
  canPlay: boolean;
  theme: string;
  themeGradient?: ThemeGradient | null;
  songNumber: number;
  totalSongs: number;
  songStatuses: Array<{
    position: number;
    status: "pending" | "missed" | "perfect" | "fast" | "average" | "slow";
    isCurrent: boolean;
    isSelected: boolean;
  }>;
  gameState: "playing" | "correct" | "failed";
  onNextSong: () => void;
  hasNextSong: boolean;
  songLink?: string | null;
  onNavigateToSong?: (position: number) => void;
  resultTitle?: string | null;
  resultArtist?: string | null;
}

const getThemeTitleTone = (title: string) => {
  const normalized = title.toLowerCase();

  if (normalized.includes("summer") || normalized.includes("sun") || normalized.includes("happy")) {
    return "bg-gradient-to-r from-amber-300 via-amber-200 to-yellow-200 bg-clip-text text-transparent drop-shadow-sm";
  }

  if (normalized.includes("rain") || normalized.includes("night") || normalized.includes("cool")) {
    return "bg-gradient-to-r from-sky-300 via-indigo-300 to-blue-200 bg-clip-text text-transparent drop-shadow-sm";
  }

  if (normalized.includes("love") || normalized.includes("heart") || normalized.includes("romance")) {
    return "bg-gradient-to-r from-rose-300 via-pink-200 to-rose-100 bg-clip-text text-transparent drop-shadow-sm";
  }

  if (normalized.includes("mythic") || normalized.includes("magic") || normalized.includes("dream")) {
    return "bg-gradient-to-r from-fuchsia-300 via-purple-300 to-indigo-300 bg-clip-text text-transparent drop-shadow-sm";
  }

  if (normalized.includes("rock") || normalized.includes("energy") || normalized.includes("anthem")) {
    return "bg-gradient-to-r from-emerald-300 via-lime-200 to-emerald-100 bg-clip-text text-transparent drop-shadow-sm";
  }

  return "text-foreground";
};

const statusToEmoji = (
  status: AudioPlayerProps["songStatuses"][number]["status"],
  isCurrent: boolean
) => {
  if (isCurrent) {
    return "🎧";
  }
  switch (status) {
    case "perfect":
      return "🦄";
    case "fast":
      return "🟩";
    case "average":
      return "🟦";
    case "slow":
      return "🟧";
    case "missed":
      return "🟥";
    default:
      return "⬛";
  }
};

const statusToLabel = (
  status: AudioPlayerProps["songStatuses"][number]["status"],
  isCurrent: boolean
) => {
  if (isCurrent) {
    return "Current attempt · Actively listening";
  }
  switch (status) {
    case "perfect":
      return "0.5s · Perfect Pitch – guessed instantly · Mythical / rare";
    case "fast":
      return "1s · Fast – quick recognition · Confident";
    case "average":
      return "2s · Average – still got it · Cool / chill";
    case "slow":
      return "4s · Slow – late but correct · Mild struggle";
    case "missed":
      return "Didn’t Guess / Wrong · Missed – fail · Final";
    default:
      return "Not Played Yet · Pending – unplayed · Neutral";
  }
};

const formatDuration = (seconds: number) => {
  const value = Number.isInteger(seconds)
    ? seconds.toString()
    : seconds.toFixed(1).replace(/\.0$/, "");
  const unit = seconds === 1 ? "second" : "seconds";
  return `${value} ${unit}`;
};

const formatResultLabel = (seconds: number) => {
  const raw = Number.isInteger(seconds)
    ? seconds.toString()
    : seconds.toFixed(1).replace(/\.0$/, "");
  return `${raw}s`;
};

type ResultSummary =
  | {
      titleEmoji?: string;
      titleText: string;
      desc: string;
      variant: "mythic" | "lightning" | "cool" | "late" | "fail";
    }
  | null;

export const AudioPlayer = ({
  attempt,
  maxAttempts,
  clipDuration,
  onPlay,
  isPlaying,
  canPlay,
  theme,
  themeGradient,
  songNumber,
  totalSongs,
  songStatuses,
  gameState,
  onNextSong,
  hasNextSong,
  songLink,
  onNavigateToSong,
  resultTitle,
  resultArtist,
}: AudioPlayerProps) => {
  const playDisabled = !canPlay || isPlaying || clipDuration === null;
  const playLabel =
    clipDuration !== null ? formatDuration(clipDuration) : "All listens used";
  const showSummary = gameState !== "playing";
  const hasGradient =
    !!themeGradient &&
    typeof themeGradient.from === "string" &&
    typeof themeGradient.to === "string";
  const gradientStops = hasGradient
    ? [themeGradient.from, themeGradient.via, themeGradient.to]
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .join(", ")
    : null;
  const gradientAngle =
    hasGradient && themeGradient?.angle && themeGradient.angle.length > 0
      ? themeGradient.angle
      : "to right";
  const themeGradientStyle =
    hasGradient && gradientStops
      ? {
          backgroundImage: `linear-gradient(${gradientAngle}, ${gradientStops})`,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          WebkitTextFillColor: "transparent",
        }
      : undefined;
  const themeTitleClass = `mt-1 text-lg font-semibold leading-snug break-words max-w-[80%] mx-auto ${
    hasGradient ? "text-transparent drop-shadow-sm" : getThemeTitleTone(theme)
  } tracking-[0.08em]`;
  const resultSummary: ResultSummary = (() => {
    if (gameState === "correct" && clipDuration !== null) {
      const durationText = formatResultLabel(clipDuration);
      const isMythic = clipDuration <= 0.5;
      const isLightning = clipDuration > 0.5 && clipDuration <= 1;
      const isCool = clipDuration > 1 && clipDuration <= 2;
      const isLate = clipDuration > 2;

      if (isMythic) {
        return {
          titleEmoji: "🦄",
          titleText: durationText,
          desc: "Mythic Ears",
          variant: "mythic",
        };
      }

      if (isLightning) {
        return {
          titleEmoji: undefined,
          titleText: durationText,
          desc: "Lightning Listener",
          variant: "lightning",
        };
      }

      if (isCool) {
        return {
          titleEmoji: undefined,
          titleText: durationText,
          desc: "Cool Tempo",
          variant: "cool",
        };
      }

      if (isLate) {
        return {
          titleEmoji: undefined,
          titleText: durationText,
          desc: "Late Beat",
          variant: "late",
        };
      }

      return null;
    }
    if (gameState === "failed") {
      return {
        titleEmoji: undefined,
        titleText: "Ded",
        desc: "Deaf Punk",
        variant: "fail",
      };
    }
    return null;
  })();

  const visualizerDelays = useMemo(
    () =>
      Array.from({ length: 20 }, (_, index) => ({
        delay: (index * 0.07) % 0.9,
        duration: 0.85 + (index % 4) * 0.12,
      })),
    []
  );
  const [showVisualizer, setShowVisualizer] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      setShowVisualizer(isPlaying);
      return;
    }

    if (isPlaying) {
      setShowVisualizer(true);
      return;
    }

    const timeout = window.setTimeout(() => {
      setShowVisualizer(false);
    }, 150);

    return () => window.clearTimeout(timeout);
  }, [isPlaying]);

  const handlePlayClick = useCallback(() => {
    setShowVisualizer(true);
    onPlay();
  }, [onPlay]);

  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
        <div className="bg-[#121216]/95 backdrop-blur-sm border-b border-border/60 px-4 py-4 text-foreground">
          <div className="text-center">
            <p className="text-[10px] font-medium uppercase tracking-[0.3em] opacity-70">
              Today&apos;s Theme
            </p>
            <p className={themeTitleClass} style={themeGradientStyle}>
              {theme}
            </p>
          </div>
        </div>
        <div
          className={`flex flex-col items-center gap-6 px-6 py-6 min-h-[280px] ${
            resultSummary?.variant === "fail"
              ? "bg-rose-950/20"
              : resultSummary?.variant === "mythic"
                ? "bg-gradient-to-b from-fuchsia-950/45 via-pink-900/20 to-transparent"
                : resultSummary?.variant === "lightning"
                  ? "bg-gradient-to-b from-emerald-950/40 via-emerald-900/15 to-transparent"
                  : ""
          }`}
        >
          <div className="flex w-full flex-1 flex-col items-center gap-3 justify-center">
            {gameState === "playing" ? (
              <>
                <div className="relative w-28 h-28 flex items-center justify-center">
                  {showVisualizer ? (
                    <div
                      className="audio-visualizer"
                      role="status"
                      aria-live="polite"
                    >
                      {visualizerDelays.map(({ delay, duration }, index) => (
                        <div
                          key={index}
                          className="audio-visualizer__bar"
                          style={{
                            animationDelay: `${delay}s`,
                            animationDuration: `${duration}s`,
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <Button
                      onClick={handlePlayClick}
                      disabled={playDisabled}
                      size="lg"
                      className="relative w-24 h-24 rounded-full border border-fuchsia-200/55 bg-[#160c23] hover:bg-[#1e1230] transition-all shadow-[0_14px_40px_rgba(192,132,252,0.28)] disabled:opacity-50"
                    >
                      <span className="absolute -inset-4 rounded-full bg-gradient-to-br from-fuchsia-300/25 via-purple-300/18 to-indigo-300/18 blur-[34px] opacity-40 animate-[pulse_4s_ease-in-out_infinite]" aria-hidden="true" />
                      <span className="absolute inset-0 rounded-full bg-gradient-radial from-white/12 via-transparent to-transparent opacity-45" aria-hidden="true" />
                      <Play className="w-24 h-24 text-white fill-white drop-shadow-[0_6px_16px_rgba(255,255,255,0.35)]" />
                    </Button>
                  )}
                </div>
                <p className="mt-5 text-sm font-semibold text-foreground text-center">
                  Attempt {Math.min(attempt, maxAttempts)} of {maxAttempts}
                </p>
                <div className="text-center text-xs text-muted-foreground/80 flex items-center gap-2 justify-center min-h-[1.25rem] mt-0">
                  {clipDuration !== null && (
                    <>
                      <Volume2 className="w-4 h-4" />
                      <span>
                        {isPlaying ? "Listening..." : `Play ${playLabel}`}
                      </span>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                {resultSummary && (
                  <>
                    <p className="text-4xl font-extrabold text-center leading-snug">
                      <span className="inline-flex items-center gap-4">
                        {resultSummary.titleEmoji && (
                          <span className="text-5xl drop-shadow-[0_0_10px_rgba(217,70,239,0.35)]">
                            {resultSummary.titleEmoji}
                          </span>
                        )}
                        <span
                          className={
                            resultSummary.variant === "mythic"
                              ? "bg-gradient-to-r from-fuchsia-400 via-pink-500 to-purple-500 bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(217,70,239,0.35)]"
                              : resultSummary.variant === "lightning"
                                ? "bg-gradient-to-r from-emerald-300 via-emerald-400 to-lime-300 bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(74,222,128,0.35)]"
                                : resultSummary.variant === "cool"
                                  ? "bg-gradient-to-r from-sky-300 via-sky-400 to-indigo-300 bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(56,189,248,0.35)]"
                                  : resultSummary.variant === "late"
                                      ? "bg-gradient-to-r from-amber-300 via-orange-400 to-orange-500 bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(251,191,36,0.35)]"
                                      : resultSummary.variant === "fail"
                                      ? "inline-flex items-center gap-3 text-foreground"
                                      : "text-foreground"
                          }
                        >
                          {resultSummary.variant === "fail"
                            ? (
                              <>
                                <span className="text-rose-500 text-2xl leading-none">
                                  ❌
                                </span>
                                <span className="text-4xl font-extrabold leading-none text-rose-400">
                                  {resultSummary.titleText}
                                </span>
                                <span className="text-rose-500 text-2xl leading-none">
                                  ❌
                                </span>
                              </>
                            )
                            : resultSummary.titleText}
                        </span>
                      </span>
                    </p>
                    <div
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold tracking-[0.2em] ${
                        resultSummary.variant === "mythic"
                          ? "bg-gradient-to-r from-fuchsia-500/20 via-pink-500/20 to-purple-500/20 text-fuchsia-100 border border-fuchsia-500/30 shadow-[0_0_18px_rgba(217,70,239,0.25)]"
                          : resultSummary.variant === "lightning"
                            ? "bg-emerald-500/15 text-emerald-200 border border-emerald-400/40"
                            : resultSummary.variant === "cool"
                              ? "bg-sky-500/10 text-sky-100 border border-sky-400/30"
                              : resultSummary.variant === "late"
                                ? "bg-amber-500/10 text-amber-100 border border-amber-400/20"
                                : resultSummary.variant === "fail"
                            ? "bg-rose-500/20 text-rose-200 border border-rose-500/40"
                                  : "bg-primary/10 text-primary border border-primary/20"
                      }`}
                    >
                      {resultSummary.desc}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {gameState !== "playing" && (resultTitle || resultArtist || songLink) && (
            <div className="w-full rounded-2xl px-4 py-3 text-center text-sm space-y-2 shadow-md border bg-card/70 border-border text-foreground">
              {resultTitle && (
                <p className="font-semibold text-base leading-tight">
                  {resultTitle}
                </p>
              )}
              {resultArtist && (
                <p className="text-muted-foreground">{resultArtist}</p>
              )}
              {songLink && (
                <a
                  href={songLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Play on YouTube
                </a>
              )}
            </div>
          )}
        </div>
        <div className="border-t border-border bg-muted/30 px-6 py-4">
          <div className="flex flex-col items-center gap-2 text-sm text-foreground">
            <span className="font-semibold uppercase tracking-[0.2em] text-xs">
              Song {Math.min(songNumber, totalSongs)} of {totalSongs}
            </span>
            <div className="flex gap-1 justify-center">
              {songStatuses.map((entry) => {
                const clickable =
                  entry.status !== "pending" || entry.isCurrent;
                return (
                  <button
                    key={entry.position}
                    type="button"
                    disabled={!clickable}
                    onClick={() =>
                      clickable ? onNavigateToSong?.(entry.position) : undefined
                    }
                    className={`relative inline-flex flex-col items-center justify-center text-2xl transition p-1 min-w-[44px] min-h-[44px] ${
                      clickable ? "cursor-pointer hover:scale-105" : "cursor-default"
                    }`}
                    title={statusToLabel(entry.status, entry.isCurrent)}
                    aria-label={statusToLabel(entry.status, entry.isCurrent)}
                  >
                    {statusToEmoji(entry.status, entry.isCurrent)}
                    <span
                      className={`mt-[2px] h-[2px] w-6 rounded-full ${
                        entry.isSelected ? "bg-indigo-400" : "bg-transparent"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
