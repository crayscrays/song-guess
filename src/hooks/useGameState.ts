import { useState, useCallback, useEffect, useRef } from "react";
import { Song, jayChouSongs } from "@/data/songs";
import { AudioPlayer } from "@/utils/audioPlayer";
import { YouTubePlayer } from "@/utils/youtubePlayer";

export type GameState = "playing" | "correct" | "failed";

export const useGameState = () => {
  const [score, setScore] = useState(0);
  const [attempt, setAttempt] = useState(1);
  const [gameState, setGameState] = useState<GameState>("playing");
  const [currentSong, setCurrentSong] = useState<Song>(getRandomSong());
  const [choices, setChoices] = useState<Song[]>(generateChoices(currentSong));
  const [selectedSong, setSelectedSong] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const youtubePlayerRef = useRef<YouTubePlayer | null>(null);

  // Initialize audio player
  useEffect(() => {
    audioPlayerRef.current = new AudioPlayer();
    youtubePlayerRef.current = new YouTubePlayer('youtube-player');
    
    return () => {
      audioPlayerRef.current?.dispose();
      youtubePlayerRef.current?.destroy();
    };
  }, []);

  function getRandomSong(): Song {
    return jayChouSongs[Math.floor(Math.random() * jayChouSongs.length)];
  }

  function generateChoices(correctSong: Song): Song[] {
    const otherSongs = jayChouSongs.filter((s) => s.id !== correctSong.id);
    const shuffled = otherSongs.sort(() => Math.random() - 0.5);
    const choices = [correctSong, ...shuffled.slice(0, 3)];
    return choices.sort(() => Math.random() - 0.5);
  }

  const handleGuess = useCallback(
    (songId: string) => {
      setSelectedSong(songId);

      if (songId === currentSong.id) {
        setGameState("correct");
        setScore((prev) => prev + (4 - attempt) * 10);
      } else if (attempt >= 3) {
        setGameState("failed");
      } else {
        setAttempt((prev) => prev + 1);
      }
    },
    [currentSong.id, attempt]
  );

  const handlePlayAudio = useCallback(async () => {
    if (isPlaying) return;
    
    setIsPlaying(true);
    try {
      // If song has YouTube ID, play from YouTube
      if (currentSong.youtubeId && youtubePlayerRef.current) {
        // Load video if not already loaded
        await youtubePlayerRef.current.loadVideo(currentSong.youtubeId);
        
        // Play segment starting from specified time (or random time if not specified)
        const startTime = currentSong.startTime || Math.floor(Math.random() * 60) + 30;
        await youtubePlayerRef.current.playSegment(startTime, attempt);
      } else if (audioPlayerRef.current) {
        // Fallback to tone if no YouTube ID
        await audioPlayerRef.current.playTone(attempt);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
    } finally {
      setIsPlaying(false);
    }
  }, [attempt, isPlaying, currentSong]);

  const nextRound = useCallback(() => {
    const newSong = getRandomSong();
    setCurrentSong(newSong);
    setChoices(generateChoices(newSong));
    setAttempt(1);
    setGameState("playing");
    setSelectedSong(null);
  }, []);

  const restart = useCallback(() => {
    const newSong = getRandomSong();
    setCurrentSong(newSong);
    setChoices(generateChoices(newSong));
    setAttempt(1);
    setGameState("playing");
    setSelectedSong(null);
    setScore(0);
  }, []);

  return {
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
  };
};
