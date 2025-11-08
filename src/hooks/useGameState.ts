import { useState, useCallback, useEffect, useRef } from "react";
import { Song, jayChouSongs } from "@/data/songs";
import { AudioPlayer } from "@/utils/audioPlayer";

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

  // Initialize audio player
  useEffect(() => {
    audioPlayerRef.current = new AudioPlayer();
    return () => {
      audioPlayerRef.current?.dispose();
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
    if (!audioPlayerRef.current || isPlaying) return;
    
    setIsPlaying(true);
    try {
      // Play a tone for the specified duration
      // In production, replace this with: 
      // await audioPlayerRef.current.playAudioFile(songUrl, attempt);
      await audioPlayerRef.current.playTone(attempt);
    } catch (error) {
      console.error('Error playing audio:', error);
    } finally {
      setIsPlaying(false);
    }
  }, [attempt, isPlaying]);

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
