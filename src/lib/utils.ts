import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generates a deterministic hash for a song ID based on the date.
 * This prevents users from easily identifying correct answers by inspecting code.
 * The hash is consistent for the same date and song ID combination.
 */
export function hashSongId(songId: string, dateKey: string): string {
  // Combine date and song ID with a salt
  const salt = "🎵🎶🎼"; // Simple salt to make reverse engineering harder
  const combined = `${dateKey}:${songId}:${salt}`;
  
  // Simple hash function - not cryptographically secure but sufficient for obfuscation
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to positive hex string and pad
  const hexHash = Math.abs(hash).toString(16).padStart(8, '0');
  
  // Add some obfuscation by mixing in date-based variation
  const dateHash = dateKey.split('-').reduce((acc, part) => {
    return acc + parseInt(part, 10);
  }, 0);
  
  return `h${hexHash}${dateHash.toString(16).padStart(4, '0')}`;
}

/**
 * Creates a map of original song IDs to their hashed versions for a given date.
 */
export function createSongIdHashMap(songIds: string[], dateKey: string): Map<string, string> {
  const map = new Map<string, string>();
  songIds.forEach(id => {
    map.set(id, hashSongId(id, dateKey));
  });
  return map;
}

/**
 * Creates a reverse map of hashed IDs to original song IDs for a given date.
 */
export function createHashToSongIdMap(songIds: string[], dateKey: string): Map<string, string> {
  const map = new Map<string, string>();
  songIds.forEach(id => {
    map.set(hashSongId(id, dateKey), id);
  });
  return map;
}
