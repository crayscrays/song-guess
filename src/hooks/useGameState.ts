import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Song, jayChouSongs } from "@/data/songs";
import { AudioPlayer } from "@/utils/audioPlayer";
import { YouTubePlayer } from "@/utils/youtubePlayer";

export type GameState = "playing" | "correct" | "failed";

export type GameResultStatus = "success" | "failed";

export interface GameResult {
  theme: string;
  order: number;
  songId: string;
  songTitle: string;
  status: GameResultStatus;
  timeSeconds: number;
  attempts: number;
  recordedAt: string;
}

const RESULTS_STORAGE_KEY = "jay-chou-tune-trek/results";
const DAILY_SONG_COUNT = 5;
const ATTEMPT_DURATIONS = [0.5, 1, 2, 4];
const MAX_ATTEMPTS = ATTEMPT_DURATIONS.length + 1;

interface DailyPlaylistSongMeta {
  title?: string;
  artist?: string;
  youtubeUrl?: string;
  sectionLabel?: string;
  startTime?: string | number;
  wrongChoices?: Array<{
    title?: string;
    artist?: string;
  }>;
}

export interface ThemeGradient {
  from: string;
  to: string;
  via?: string;
  angle?: string;
}

interface DailyPlaylist {
  date?: string;
  theme?: string;
  themeGradient?: ThemeGradient;
  songs?: DailyPlaylistSongMeta[];
}

interface GameSong {
  id: string;
  title: string;
  titleChinese?: string;
  subtitle?: string;
  youtubeId: string | null;
  youtubeUrl?: string | null;
  startTimeSeconds: number | null;
  sectionLabel?: string;
  wrongChoices?: Array<{
    title: string;
    artist?: string;
  }>;
}

type GameFeedback =
  | { type: "wrong"; songId: string; timestamp: number }
  | { type: "correct"; timestamp: number }
  | { type: "failed"; timestamp: number }
  | null;

const PROGRESS_STORAGE_PREFIX = "jay-chou-tune-trek/progress/";

interface StoredProgress {
  attempts: Record<string, number>;
  disabledChoices: Record<string, string[]>;
  currentOrder?: number;
}

const playlistModules = import.meta.glob<DailyPlaylist>(
  "../../daily-playlists/english/*.json",
  {
    eager: true,
    import: "default",
  }
);

const getClipDurationForAttempt = (attempt: number): number | null => {
  if (attempt <= 0) return null;
  if (attempt > ATTEMPT_DURATIONS.length) return null;
  return ATTEMPT_DURATIONS[attempt - 1];
};

const hashFromSeed = (seed: string) =>
  seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

const shuffleWithSeed = <T,>(array: T[], seed: number): T[] => {
  const result = [...array];
  let currentSeed = seed;

  for (let i = result.length - 1; i > 0; i--) {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    const j = currentSeed % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
};

const getFallbackSongsForToday = (): GameSong[] => {
  const today = new Date();
  const dateKey = today.toISOString().slice(0, 10);
  const seed = hashFromSeed(dateKey);
  const shuffled = shuffleWithSeed(fallbackGameSongs, seed);
  return shuffled.slice(0, DAILY_SONG_COUNT);
};

const formatThemeLabel = (date: Date) => {
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  });
  return `Daily Mix • ${formatter.format(date)}`;
};

const loadLatestPlaylist = (): DailyPlaylist | null => {
  const playlists: Array<DailyPlaylist & { __date?: string }> = Object.entries(
    playlistModules
  )
    .map(([path, payload]) => {
      const fileDate = path.match(/(\d{4}-\d{2}-\d{2})\.json$/)?.[1];
      return { ...payload, __date: fileDate };
    })
    .filter(
      (playlist): playlist is DailyPlaylist & { __date?: string } =>
        !!playlist
    )
    .sort((a, b) => {
      const dateA = a.date ?? a.__date ?? "";
      const dateB = b.date ?? b.__date ?? "";
      return dateA.localeCompare(dateB);
    });

  const latest = playlists.at(-1);
  if (!latest) return null;
  const { __date, ...rest } = latest;
  return rest;
};

const parseStartTimeToSeconds = (
  value: DailyPlaylistSongMeta["startTime"]
): number | null => {
  if (value === undefined || value === null) return null;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value !== "string") return null;

  const parts = value.split(":");
  if (parts.length !== 2) return null;

  const minutes = Number(parts[0]);
  const seconds = Number(parts[1]);

  if (Number.isNaN(minutes) || Number.isNaN(seconds)) {
    return null;
  }

  return minutes * 60 + seconds;
};

const extractYouTubeId = (url: string | undefined | null): string | null => {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.slice(1) || null;
    }
    const id = parsed.searchParams.get("v");
    if (id) {
      return id;
    }
  } catch {
    // fall through to regex
  }

  const match = url.match(
    /(?:v=|\/watch\/|youtu\.be\/|embed\/)([0-9A-Za-z_-]{11})/
  );
  return match ? match[1] : null;
};

const convertPlaylistSongToGameSong = (
  song: DailyPlaylistSongMeta,
  index: number
): GameSong | null => {
  const youtubeId = extractYouTubeId(song.youtubeUrl);
  if (!youtubeId) return null;

  const title = song.title?.trim();
  if (!title) return null;

  return {
    id: `playlist-${index + 1}`,
    title,
    subtitle: song.artist?.trim(),
    youtubeId,
    youtubeUrl: song.youtubeUrl ?? null,
    startTimeSeconds: parseStartTimeToSeconds(song.startTime),
    sectionLabel: song.sectionLabel,
    wrongChoices:
      song.wrongChoices
        ?.map((choice) => ({
          title: choice.title?.trim() ?? "",
          artist: choice.artist?.trim(),
        }))
        .filter((choice) => choice.title.length > 0) ?? [],
  };
};

const fallbackGameSongs: GameSong[] = jayChouSongs.map((song) => ({
  id: `jay-${song.id}`,
  title: song.title,
  titleChinese: song.titleChinese,
  subtitle: song.titleChinese,
  youtubeId: song.youtubeId ?? null,
  youtubeUrl: song.youtubeId
    ? `https://www.youtube.com/watch?v=${song.youtubeId}`
    : null,
  startTimeSeconds:
    typeof song.startTime === "number" && !Number.isNaN(song.startTime)
      ? song.startTime
      : null,
  sectionLabel: undefined,
}));

const buildChoicesForSong = (
  song: GameSong,
  songsPool: GameSong[]
): GameSong[] => {
  const wrongChoices =
    song.wrongChoices && song.wrongChoices.length > 0
      ? song.wrongChoices
      : undefined;

  if (wrongChoices) {
    const mappedWrong = wrongChoices.map((choice, index) => ({
      id: `wrong-${song.id}-${index}`,
      title: choice.title,
      subtitle: choice.artist,
      youtubeId: null,
      youtubeUrl: null,
      startTimeSeconds: null,
      sectionLabel: undefined,
      wrongChoices: [],
    }));

    const selection = [song, ...mappedWrong].slice(0, 8);
    return selection.sort(() => Math.random() - 0.5);
  }

  const others = songsPool.filter((candidate) => candidate.id !== song.id);
  const shuffled = others.sort(() => Math.random() - 0.5);
  const selection = [song, ...shuffled.slice(0, 3)];
  return selection.sort(() => Math.random() - 0.5);
};

export const useGameState = () => {
  const [attempt, setAttempt] = useState(1);
  const [gameState, setGameState] = useState<GameState>("playing");
  const [currentSong, setCurrentSong] = useState<GameSong | null>(null);
  const [choices, setChoices] = useState<GameSong[]>([]);
  const [selectedSong, setSelectedSong] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [dailySongs, setDailySongs] = useState<GameSong[]>([]);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [isDailyComplete, setIsDailyComplete] = useState(false);
  const [theme, setTheme] = useState(formatThemeLabel(new Date()));
  const [themeGradient, setThemeGradient] = useState<ThemeGradient | null>(null);
  const [disabledChoiceIds, setDisabledChoiceIds] = useState<Set<string>>(
    new Set()
  );
  const [lastFeedback, setLastFeedback] = useState<GameFeedback>(null);
  const [results, setResults] = useState<GameResult[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const stored = window.localStorage.getItem(RESULTS_STORAGE_KEY);
      if (!stored) {
        return [];
      }
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Failed to read stored results", error);
      return [];
    }
  });
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const youtubePlayerRef = useRef<YouTubePlayer | null>(null);
  const roundStartTimeRef = useRef<number | null>(null);
  const progressRef = useRef<StoredProgress>({
    attempts: {},
    disabledChoices: {},
    currentOrder: 1,
  });
  const lastCompletedRef = useRef<{ order: number; timestamp: number } | null>(null);
  const [progressDateKey, setProgressDateKey] = useState<string | null>(null);
  const persistProgress = useCallback(() => {
    if (!progressDateKey || typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(
        `${PROGRESS_STORAGE_PREFIX}${progressDateKey}`,
        JSON.stringify(progressRef.current)
      );
    } catch (error) {
      console.error("Failed to persist progress", error);
    }
  }, [progressDateKey]);

  const clipDuration = useMemo(
    () => getClipDurationForAttempt(attempt),
    [attempt]
  );

  const totalSongs = dailySongs.length;
  const hasNextSong = currentSongIndex < totalSongs - 1;
  const recordResult = useCallback(
    (status: GameResultStatus) => {
      if (!currentSong || roundStartTimeRef.current === null) {
        return;
      }

      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const durationMs = Math.max(now - roundStartTimeRef.current, 0);
      const durationSeconds = Number((durationMs / 1000).toFixed(2));

      const displayTitle = currentSong.titleChinese ?? currentSong.title;

      const result: GameResult = {
        theme,
        order: currentSongIndex + 1,
        songId: currentSong.id,
        songTitle: displayTitle,
        status,
        timeSeconds: durationSeconds,
        attempts: attempt,
        recordedAt: new Date().toISOString(),
      };

      roundStartTimeRef.current = null;

      lastCompletedRef.current = {
        order: currentSongIndex + 1,
        timestamp: Date.now(),
      };

      setResults((prev) => {
        const existingIndex = prev.findIndex(
          (entry) =>
            entry.theme === theme && entry.order === currentSongIndex + 1
        );

        if (existingIndex === -1) {
          return [...prev, result];
        }

        const updated = [...prev];
        updated[existingIndex] = result;
        return updated;
      });
    },
    [attempt, currentSong, currentSongIndex, theme]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        RESULTS_STORAGE_KEY,
        JSON.stringify(results)
      );
    } catch (error) {
      console.error("Failed to persist results", error);
    }
  }, [results]);

  const startRound = useCallback(
    (
      index: number,
      pool: GameSong[],
      explicitTheme?: string,
      options?: { persistOrder?: boolean }
    ) => {
      const shouldPersistOrder = options?.persistOrder ?? true;
      const song = pool[index] ?? null;
      if (!song) {
        roundStartTimeRef.current = null;
        setCurrentSongIndex(index);
        setCurrentSong(null);
        setChoices([]);
        setDisabledChoiceIds(new Set());
        setGameState("playing");
        setSelectedSong(null);
        if (shouldPersistOrder) {
          progressRef.current.currentOrder = undefined;
          persistProgress();
        }
        return;
      }

      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const storedAttempt = progressRef.current.attempts[song.id];
      const attemptValue =
        storedAttempt && storedAttempt >= 1
          ? Math.min(storedAttempt, MAX_ATTEMPTS)
          : 1;
      const storedDisabled = progressRef.current.disabledChoices[song.id];
      const disabledSet = new Set(
        Array.isArray(storedDisabled) ? storedDisabled : []
      );

      const themeForRound = explicitTheme ?? theme;
      const matchingResult = results.find(
        (entry) =>
          entry.order === index + 1 &&
          (!themeForRound || entry.theme === themeForRound)
      );

      setCurrentSongIndex(index);
      setCurrentSong(song);
      setChoices(buildChoicesForSong(song, pool));
      setAttempt(attemptValue);
      setDisabledChoiceIds(disabledSet);
      setLastFeedback(null);

      if (matchingResult) {
        roundStartTimeRef.current = null;
        if (matchingResult.status === "failed") {
          setGameState("failed");
          setSelectedSong(null);
        } else {
          setGameState("correct");
          setSelectedSong(song.id);
        }
      } else {
        roundStartTimeRef.current = now;
        setGameState("playing");
        setSelectedSong(null);
      }

      if (shouldPersistOrder) {
        progressRef.current.currentOrder = index + 1;
        persistProgress();
      }
    },
    [persistProgress, results, theme]
  );

  const loadDailySongs = useCallback(() => {
    const today = new Date();
    const playlist = loadLatestPlaylist();
    const dateKey = playlist?.date ?? today.toISOString().slice(0, 10);
    setProgressDateKey(dateKey);

    if (typeof window !== "undefined") {
      try {
        const storedRaw = window.localStorage.getItem(
          `${PROGRESS_STORAGE_PREFIX}${dateKey}`
        );
        if (storedRaw) {
          const parsed = JSON.parse(storedRaw);
          if (
            parsed &&
            typeof parsed === "object" &&
            parsed.attempts &&
            parsed.disabledChoices
          ) {
            progressRef.current = {
              attempts: parsed.attempts ?? {},
              disabledChoices: parsed.disabledChoices ?? {},
              currentOrder:
                typeof parsed.currentOrder === "number"
                  ? parsed.currentOrder
                  : 1,
            };
          } else {
            progressRef.current = {
              attempts: {},
              disabledChoices: {},
              currentOrder: 1,
            };
          }
        } else {
          progressRef.current = {
            attempts: {},
            disabledChoices: {},
            currentOrder: 1,
          };
        }
      } catch (error) {
        console.error("Failed to parse stored progress", error);
        progressRef.current = {
          attempts: {},
          disabledChoices: {},
          currentOrder: 1,
        };
      }
    } else {
      progressRef.current = {
        attempts: {},
        disabledChoices: {},
        currentOrder: 1,
      };
    }

    let songs: GameSong[] = [];

    if (playlist?.songs && playlist.songs.length > 0) {
      songs = playlist.songs
        .map((song, index) => convertPlaylistSongToGameSong(song, index))
        .filter((song): song is GameSong => song !== null)
        .slice(0, DAILY_SONG_COUNT);
    }

    if (songs.length === 0) {
      songs = getFallbackSongsForToday();
    }

    const newTheme = playlist?.theme ?? formatThemeLabel(today);
    setTheme(newTheme);
    setThemeGradient(playlist?.themeGradient ?? null);
    setDailySongs(songs);

    const rawOrder = progressRef.current.currentOrder ?? 1;
    let clampedIndex = Math.min(
      Math.max(rawOrder - 1, 0),
      songs.length > 0 ? songs.length - 1 : 0
    );

    const relevantResults = results.filter(
      (entry) => entry.theme === newTheme
    );
    const completedOrders = new Set(relevantResults.map((entry) => entry.order));
    const allComplete =
      songs.length > 0 && songs.every((_, idx) => completedOrders.has(idx + 1));

    const recentCompletion = lastCompletedRef.current;
    const now = Date.now();
    const shouldStickToRecentCompletion =
      recentCompletion !== null &&
      now - recentCompletion.timestamp < 5000 &&
      recentCompletion.order >= 1 &&
      recentCompletion.order <= songs.length;

    if (!shouldStickToRecentCompletion) {
      if (!allComplete) {
        const firstPendingIndex = songs.findIndex(
          (_, idx) => !completedOrders.has(idx + 1)
        );
        if (firstPendingIndex !== -1) {
          clampedIndex = firstPendingIndex;
          progressRef.current.currentOrder = firstPendingIndex + 1;
        }
      }
      lastCompletedRef.current = null;
    } else {
      clampedIndex = recentCompletion.order - 1;
    }

    setIsDailyComplete(allComplete);

    startRound(clampedIndex, songs, newTheme, { persistOrder: true });
  }, [results, startRound]);

  useEffect(() => {
    audioPlayerRef.current = new AudioPlayer();
    youtubePlayerRef.current = new YouTubePlayer("youtube-player");

    loadDailySongs();

    return () => {
      audioPlayerRef.current?.dispose();
      youtubePlayerRef.current?.destroy();
    };
  }, [loadDailySongs]);

  const handleGuess = useCallback(
    (songId: string) => {
      if (!currentSong) return;

      const isLastSong = currentSongIndex >= dailySongs.length - 1;

      setSelectedSong(songId);

      if (songId === currentSong.id) {
        setGameState("correct");
        setLastFeedback({ type: "correct", timestamp: Date.now() });
        recordResult("success");
        progressRef.current.attempts[currentSong.id] = attempt;
        persistProgress();
        if (isLastSong) {
          setIsDailyComplete(true);
        }
      } else if (attempt >= MAX_ATTEMPTS - 1) {
        setAttempt(MAX_ATTEMPTS);
        setGameState("failed");
        setLastFeedback({ type: "failed", timestamp: Date.now() });
        recordResult("failed");
        progressRef.current.attempts[currentSong.id] = MAX_ATTEMPTS;
        persistProgress();
        if (isLastSong) {
          setIsDailyComplete(true);
        }
      } else {
        setDisabledChoiceIds((prev) => {
          const next = new Set(prev);
          next.add(songId);
          progressRef.current.disabledChoices[currentSong.id] = Array.from(
            next
          );
          persistProgress();
          return next;
        });
        setLastFeedback({ type: "wrong", songId, timestamp: Date.now() });
        setAttempt((prev) => {
          const updated = Math.min(prev + 1, MAX_ATTEMPTS);
          progressRef.current.attempts[currentSong.id] = updated;
          persistProgress();
          return updated;
        });
      }
    },
    [
      currentSong,
      attempt,
      currentSongIndex,
      dailySongs.length,
      recordResult,
      persistProgress,
    ]
  );

  const handlePlayAudio = useCallback(async () => {
    if (!currentSong || !clipDuration) return;

    if (gameState !== "playing") return;
    if (isPlaying) return;

    setIsPlaying(true);
    try {
      if (currentSong.youtubeId && youtubePlayerRef.current) {
        await youtubePlayerRef.current.loadVideo(currentSong.youtubeId);
        const startTime =
          currentSong.startTimeSeconds ??
          Math.floor(Math.random() * 60) + 30;
        await youtubePlayerRef.current.playSegment(startTime, clipDuration);
      } else if (audioPlayerRef.current) {
        await audioPlayerRef.current.playTone(clipDuration);
      }
    } catch (error) {
      console.error("handlePlayAudio: Error playing audio:", error);
    } finally {
      setIsPlaying(false);
    }
  }, [clipDuration, currentSong, gameState, isPlaying]);

  const nextRound = useCallback(() => {
    if (!hasNextSong) {
      setIsDailyComplete(true);
      return;
    }

    const nextIndex = currentSongIndex + 1;
    setIsDailyComplete(false);
    lastCompletedRef.current = null;
    startRound(nextIndex, dailySongs, undefined, { persistOrder: true });
  }, [currentSongIndex, dailySongs, hasNextSong, startRound]);

  const viewSong = useCallback(
    (order: number) => {
      if (order < 1 || order > dailySongs.length) return;
      lastCompletedRef.current = null;
      startRound(order - 1, dailySongs, undefined, { persistOrder: false });
    },
    [dailySongs, startRound]
  );

  const restart = useCallback(() => {
    lastCompletedRef.current = null;
    loadDailySongs();
  }, [loadDailySongs]);

  useEffect(() => {
    const youtubePlayer = youtubePlayerRef.current;
    const youtubeId = currentSong?.youtubeId;
    if (!youtubePlayer || !youtubeId) {
      return;
    }

    let isCancelled = false;

    youtubePlayer
      .loadVideo(youtubeId)
      .catch((error) => {
        if (!isCancelled) {
          console.error("useGameState: Failed to preload video:", error);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [currentSong?.youtubeId]);

  return {
    attempt,
    maxAttempts: MAX_ATTEMPTS,
    clipDuration,
    gameState,
    currentSong,
    choices,
    selectedSong,
    isPlaying,
    results,
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
  };
};
