import { useState, useCallback } from "react";
import { Song, jayChouSongs } from "@/data/songs";

export type GameState = "playing" | "correct" | "failed";

export const useGameState = () => {
  const [score, setScore] = useState(0);
  const [attempt, setAttempt] = useState(1);
  const [gameState, setGameState] = useState<GameState>("playing");
  const [currentSong, setCurrentSong] = useState<Song>(getRandomSong());
  const [choices, setChoices] = useState<Song[]>(generateChoices(currentSong));
  const [selectedSong, setSelectedSong] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

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

  const handlePlayAudio = useCallback(() => {
    setIsPlaying(true);
    // Mock audio playback - in real app, this would play actual audio
    setTimeout(() => {
      setIsPlaying(false);
    }, attempt * 1000);
  }, [attempt]);

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
