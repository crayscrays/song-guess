import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import confetti from "canvas-confetti";
import { GameHeader } from "@/components/GameHeader";
import { AudioPlayer } from "@/components/AudioPlayer";
import { GameControls } from "@/components/GameControls";
import { useGameState } from "@/hooks/useGameState";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SongChoices } from "@/components/SongChoices";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

const Index = () => {
  const shareTimeoutRef = useRef<number | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const {
    attempt,
    maxAttempts,
    clipDuration,
    gameState,
    currentSong,
    choices,
    selectedSong,
    isPlaying,
    handleGuess,
    handlePlayAudio,
    nextRound,
    restart,
    viewSong,
    currentSongIndex,
    totalSongs,
    hasNextSong,
    isDailyComplete,
    theme,
    themeGradient,
    disabledChoiceIds,
    lastFeedback,
    results,
    loadError,
  } = useGameState();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [pendingGuess, setPendingGuess] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [activeFeedback, setActiveFeedback] = useState<{
    timestamp: number;
    type: "wrong" | "failed";
  } | null>(null);

  const songLabel = currentSong
    ? currentSong.titleChinese ?? currentSong.title
    : "";

  // Update document title with today's date
  useEffect(() => {
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
    document.title = `Song Guess - ${dateStr}`;
  }, []);

  useEffect(() => {
    if (gameState !== "playing" && isSheetOpen) {
      setIsSheetOpen(false);
    }
  }, [gameState, isSheetOpen]);

  const formatDuration = (seconds: number) => {
    const value = Number.isInteger(seconds)
      ? seconds.toString()
      : seconds.toFixed(1).replace(/\.0$/, "");
    const unit = seconds === 1 ? "second" : "seconds";
    return `${value} ${unit}`;
  };

  const songNumber = totalSongs > 0 ? currentSongIndex + 1 : 0;
  const canPlayAudio = gameState === "playing" && clipDuration !== null;
  const clipDurationLabel = useMemo(() => {
    if (clipDuration === null) return null;
    const formatted = Number.isInteger(clipDuration)
      ? clipDuration.toFixed(0)
      : clipDuration.toFixed(1).replace(/\.0$/, "");
    return `${formatted}s`;
  }, [clipDuration]);

  const songLink = useMemo(() => {
    // Only reveal YouTube link after game state changes (correct guess or failed)
    if (gameState === "playing" || !currentSong?.youtubeUrl) return null;
    try {
      const url = new URL(currentSong.youtubeUrl);
      const start = Math.floor(currentSong.startTimeSeconds ?? 0);
      if (start > 0) {
        url.searchParams.set("t", `${start}`);
      }
      return url.toString();
    } catch {
      const start = Math.floor(currentSong?.startTimeSeconds ?? 0);
      if (start > 0) {
        return `${currentSong.youtubeUrl}?t=${start}`;
      }
      return currentSong.youtubeUrl;
    }
  }, [currentSong, gameState]);

  const songStatuses = useMemo(() => {
    const firstPendingOrder = Array.from({ length: totalSongs }).reduce<
      number | null
    >((acc, _, index) => {
      const order = index + 1;
      if (acc !== null) return acc;
      const entry = results.find((item) => item.order === order);
      return entry ? acc : order;
    }, null);

    const currentAttemptOrder = firstPendingOrder;

    return Array.from({ length: totalSongs }).map((_, index) => {
      const order = index + 1;
      const entry = results.find((item) => item.order === order);
      if (!entry) {
        return {
          position: order,
          status: "pending" as const,
          isCurrent: currentAttemptOrder !== null && order === currentAttemptOrder,
          isSelected: order === songNumber,
        };
      }
      if (entry.status === "failed") {
        return {
          position: order,
          status: "missed" as const,
          isCurrent: currentAttemptOrder !== null && order === currentAttemptOrder,
          isSelected: order === songNumber,
        };
      }
      const attempts = entry.attempts;
      const status =
        attempts <= 1
          ? "perfect"
          : attempts === 2
            ? "fast"
            : attempts === 3
              ? "average"
              : "slow";
      return {
        position: order,
        status,
        isCurrent: currentAttemptOrder !== null && order === currentAttemptOrder,
        isSelected: order === songNumber,
      };
    });
  }, [results, totalSongs, songNumber]);

  const handleShareResults = useCallback(async () => {
    if (!isDailyComplete || results.length === 0) return;

    const sorted = [...results].sort((a, b) => a.order - b.order);
    const icons = sorted.map((entry) => {
      if (entry.status === "failed") return "🟥";
      if (entry.attempts <= 1) return "🦄";
      if (entry.attempts === 2) return "🟩";
      if (entry.attempts === 3) return "🟦";
      return "🟧";
    });

    const separator = "-".repeat(Math.max(theme.length, 12));
    const date = new Date();
    const header = `SongGuess.app ${date.getDate()}/${date.getMonth() + 1}`;
    const summary = [header, "", icons.join(" ")].join("\n");

    try {
      setIsSharing(true);
      await navigator.clipboard.writeText(summary);
      setShareCopied(true);
      if (shareTimeoutRef.current !== null) {
        clearTimeout(shareTimeoutRef.current);
      }
      shareTimeoutRef.current = window.setTimeout(() => {
        setShareCopied(false);
        shareTimeoutRef.current = null;
      }, 1500);
    } catch (error) {
      console.error("Share results failed", error);
    } finally {
      setIsSharing(false);
    }
  }, [isDailyComplete, results, theme]);

  useEffect(() => {
    return () => {
      if (shareTimeoutRef.current !== null) {
        clearTimeout(shareTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!lastFeedback) {
      return;
    }
    if (lastFeedback.type === "wrong" || lastFeedback.type === "failed") {
      setActiveFeedback({
        timestamp: lastFeedback.timestamp,
        type: lastFeedback.type,
      });
    }
  }, [lastFeedback]);

  useEffect(() => {
    if (lastFeedback?.type !== "correct") {
      return;
    }

    const duration = 1500;
    const animationEnd = Date.now() + duration;
    const defaults = {
      startVelocity: 54,
      spread: 360,
      ticks: 70,
      zIndex: 1100,
      gravity: 0.8,
      colors: ["#a855f7", "#6366f1", "#22d3ee", "#f97316", "#fbbf24"],
    } satisfies confetti.Options;

    const shoot = () => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        return false;
      }

      const particleCount = Math.max(25, Math.round(80 * (timeLeft / duration)));

      confetti({
        ...defaults,
        particleCount,
        origin: { x: Math.random() * 0.3 + 0.1, y: Math.random() * 0.2 + 0.2 },
      });

      confetti({
        ...defaults,
        particleCount: Math.max(20, Math.round(particleCount * 0.6)),
        origin: { x: Math.random() * 0.3 + 0.6, y: Math.random() * 0.2 + 0.2 },
      });

      return true;
    };

    shoot();
    const interval = window.setInterval(() => {
      if (!shoot()) {
        window.clearInterval(interval);
      }
    }, 160);

    return () => {
      window.clearInterval(interval);
    };
  }, [lastFeedback]);

  useEffect(() => {
    if (activeFeedback === null) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setActiveFeedback(null);
    }, 2800);
    return () => window.clearTimeout(timeout);
  }, [activeFeedback]);

  const currentSongStatus = songStatuses.find((status) => status.position === songNumber);

  const pendingChoice = useMemo(
    () => choices.find((choice) => choice.id === pendingGuess) ?? null,
    [choices, pendingGuess]
  );

  const requestGuess = (songId: string) => {
    if (disabledChoiceIds.has(songId)) return;
    setPendingGuess(songId);
    setIsConfirmOpen(true);
  };

  const closeConfirm = () => {
    setIsConfirmOpen(false);
    setPendingGuess(null);
  };

  const confirmGuess = () => {
    if (!pendingGuess) return;
    handleGuess(pendingGuess);
    closeConfirm();
    setIsSheetOpen(false);
  };

  // Show error screen if there's a load error
  if (loadError) {
    return (
      <div className="min-h-screen bg-gradient-bg p-4 md:p-8 flex items-center justify-center">
        <div className="max-w-md w-full mx-auto text-center space-y-6 px-4">
          <div className="rounded-3xl bg-destructive/10 border border-destructive/20 p-8 backdrop-blur-sm">
            <h1 className="text-2xl font-bold text-destructive mb-4">⚠️ Error Loading Songs</h1>
            <p className="text-foreground/80 mb-6">{loadError}</p>
            <Button
              onClick={restart}
              className="rounded-full px-6 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white hover:from-pink-600 hover:via-purple-600 hover:to-indigo-600 border-0"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Don't render until we have a current song
  if (!currentSong) {
    return null;
  }

  return (
    <>
      {/* Visually hidden YouTube player container (audio only) */}
      <div
        id="youtube-player"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
        aria-hidden="true"
      />
      
      <div className="min-h-screen bg-gradient-bg p-2 md:p-8">
        {activeFeedback !== null && (
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="w-full max-w-xs rounded-3xl bg-destructive/90 px-5 py-5 text-center text-destructive-foreground shadow-[0_16px_48px_rgba(255,0,0,0.3)] backdrop-blur-sm motion-safe:animate-wrong-feedback motion-reduce:animate-none motion-reduce:transition-none">
              <p className="text-lg font-black uppercase tracking-[0.45em] text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.35)]">
                {activeFeedback.type === "failed" ? "Ded!" : "Wrongggg!"}
              </p>
              {activeFeedback.type === "wrong" && clipDurationLabel && (
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/85">
                  Playtime increases to {clipDurationLabel}
                </p>
              )}
            </div>
          </div>
        )}
        <div className="max-w-4xl mx-auto space-y-1 md:space-y-6 px-2 md:px-4">
          <GameHeader
            currentSongNumber={songNumber}
            totalSongs={totalSongs}
            isDailyComplete={isDailyComplete}
          />
          <AudioPlayer
            attempt={attempt}
            maxAttempts={maxAttempts}
            clipDuration={clipDuration}
            onPlay={handlePlayAudio}
            isPlaying={isPlaying}
            canPlay={canPlayAudio}
            theme={theme}
            themeGradient={themeGradient}
            songNumber={songNumber}
            totalSongs={totalSongs}
            songStatuses={songStatuses}
            gameState={gameState}
            onNextSong={nextRound}
            hasNextSong={hasNextSong}
            songLink={songLink}
            onNavigateToSong={viewSong}
            resultTitle={gameState !== "playing" ? currentSong?.titleChinese ?? currentSong?.title ?? null : null}
            resultArtist={gameState !== "playing" ? currentSong?.subtitle ?? null : null}
          />

          <GameControls
            onNextRound={nextRound}
            onRestart={restart}
            showNextRound={
              hasNextSong && gameState === "correct"
            }
            showRestart={gameState !== "playing" && !hasNextSong && !isDailyComplete}
            nextLabel="Next Song"
            restartLabel={isDailyComplete ? "Play Again" : "Try Again"}
          />

        </div>
        <div className="fixed bottom-2 md:bottom-6 inset-x-0 z-40">
          <div className="max-w-4xl mx-auto px-2 md:px-4">
            <div className="w-full max-w-2xl mx-auto box-border px-2 md:px-4">
              {isDailyComplete ? (
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#d946ef]/45 via-[#a855f7]/40 to-[#6366f1]/45 blur-3xl opacity-85 pointer-events-none" aria-hidden="true" />
                  <Button
                    size="lg"
                    className="w-full py-3 md:py-6 text-sm md:text-lg font-semibold uppercase tracking-[0.18em] font-['Roboto',sans-serif] bg-gradient-to-r from-[#d946ef] via-[#a855f7] to-[#6366f1] text-white border border-white/20 shadow-[0_18px_45px_rgba(168,85,247,0.35)] hover:from-[#e879f9] hover:via-[#c084fc] hover:to-[#818cf8] focus-visible:ring-[#e879f9]/70"
                    onClick={handleShareResults}
                    disabled={isSharing}
                  >
                    {isSharing ? "Preparing..." : "Share My Result"}
                  </Button>
                  <div
                    className={`pointer-events-none absolute -top-14 left-1/2 -translate-x-1/2 rounded-full bg-foreground text-background px-4 py-2 text-xs font-semibold shadow-lg ring-1 ring-background/40 transition-opacity duration-300 ${shareCopied ? "opacity-100" : "opacity-0"}`}
                  >
                    Result Copied
                  </div>
                </div>
              ) : currentSongStatus?.status === "pending" ? (
                <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                  <SheetTrigger asChild>
                    <Button
                      size="lg"
                      className="w-full py-3 md:py-6 text-sm md:text-lg font-semibold uppercase tracking-[0.18em] bg-gradient-to-r from-[#5a3cc6] via-[#7c4ce0] to-[#c056f0] text-white border border-white/20 hover:from-[#6a43d0] hover:via-[#8a57ea] hover:to-[#d264f5] focus-visible:ring-[#d8b4fe]/60"
                      disabled={gameState !== "playing"}
                    >
                      Guess Now
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="bottom"
                    className="max-h-[80vh] overflow-y-auto rounded-t-3xl"
                  >
                    <SheetHeader>
                      <SheetTitle className="text-lg font-semibold uppercase tracking-[0.3em] text-foreground">
                        i guess it&apos;s...
                      </SheetTitle>
                    </SheetHeader>
                    <div className="mt-6">
                      <SongChoices
                        choices={choices}
                        selectedSong={selectedSong}
                        correctSong={
                          gameState !== "playing" && currentSong ? currentSong.id : null
                        }
                        onSelect={requestGuess}
                        disabled={isPlaying || gameState !== "playing"}
                        disabledChoiceIds={disabledChoiceIds}
                        isPlaying={gameState === "playing"}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              ) : (
                <Button
                  size="lg"
                  className="w-full py-3 md:py-6 text-sm md:text-lg font-semibold uppercase tracking-[0.18em] bg-gradient-to-r from-[#5a3cc6] via-[#7c4ce0] to-[#c056f0] text-white border border-white/20 hover:from-[#6a43d0] hover:via-[#8a57ea] hover:to-[#d264f5] focus-visible:ring-[#d8b4fe]/60"
                  onClick={nextRound}
                  disabled={!hasNextSong}
                >
                  {hasNextSong ? "Next Song" : "All Songs Complete"}
                </Button>
              )}
            </div>
          </div>
        </div>
        <AlertDialog
          open={isConfirmOpen}
          onOpenChange={(open) => {
            if (open) {
              setIsConfirmOpen(true);
            } else {
              closeConfirm();
            }
          }}
        >
          <AlertDialogContent className="rounded-3xl mx-auto max-w-xs sm:max-w-md">
            <AlertDialogHeader className="text-center space-y-2">
              <AlertDialogTitle>Confirm your guess</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingChoice
                  ? `Lock in "${pendingChoice.titleChinese ?? pendingChoice.title}${pendingChoice.subtitle ? ` by ${pendingChoice.subtitle}` : ''}" as your answer?`
                  : "Lock in this selection?"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="sm:justify-center sm:space-x-4">
              <AlertDialogCancel onClick={closeConfirm} className="rounded-full px-6">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={confirmGuess} className="rounded-full px-6 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white hover:from-pink-600 hover:via-purple-600 hover:to-indigo-600 border-0">
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
};

export default Index;
