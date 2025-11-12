import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Helper script to manually update YouTube URLs in a playlist JSON file
 * Usage: node scripts/updatePlaylistUrls.js <playlist-file> <song-index> <new-url>
 * 
 * Example:
 *   node scripts/updatePlaylistUrls.js daily-playlists/chinese/2025-11-12.json 0 "https://www.youtube.com/watch?v=REAL_VIDEO_ID"
 */

async function updatePlaylistUrl(filePath, songIndex, newUrl) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    const content = await readFile(fullPath, "utf8");
    const playlist = JSON.parse(content);

    if (!Array.isArray(playlist.songs)) {
      console.error("Playlist does not have a songs array");
      process.exit(1);
    }

    if (songIndex < 0 || songIndex >= playlist.songs.length) {
      console.error(`Song index ${songIndex} is out of range. Playlist has ${playlist.songs.length} songs.`);
      process.exit(1);
    }

    const song = playlist.songs[songIndex];
    const oldUrl = song.youtubeUrl;

    // Validate URL format
    const youtubeUrlPattern = /^(https?:\/\/(www\.)?youtube\.com\/watch\?v=[A-Za-z0-9_-]{6,}|https?:\/\/(music\.)?youtube\.com\/watch\?v=[A-Za-z0-9_-]{6,}|https?:\/\/youtu\.be\/[A-Za-z0-9_-]{6,})$/;
    if (!youtubeUrlPattern.test(newUrl)) {
      console.error(`Invalid YouTube URL format: ${newUrl}`);
      process.exit(1);
    }

    song.youtubeUrl = newUrl;
    playlist.generatedAt = new Date().toISOString();
    playlist.updatedManually = true;

    await writeFile(fullPath, JSON.stringify(playlist, null, 2), "utf8");

    console.log(`✅ Updated song ${songIndex + 1}: "${song.title}" by "${song.artist}"`);
    console.log(`   Old URL: ${oldUrl}`);
    console.log(`   New URL: ${newUrl}`);
    console.log(`\n📝 File saved: ${fullPath}`);
  } catch (error) {
    console.error("Error updating playlist:", error.message);
    process.exit(1);
  }
}

// Interactive mode: show playlist and let user update URLs
async function interactiveMode(filePath) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    const content = await readFile(fullPath, "utf8");
    const playlist = JSON.parse(content);

    if (!Array.isArray(playlist.songs)) {
      console.error("Playlist does not have a songs array");
      process.exit(1);
    }

    console.log(`\n📋 Playlist: ${playlist.theme || "Unknown Theme"}`);
    console.log(`📅 Date: ${playlist.date}`);
    console.log(`\n🎵 Songs in playlist:\n`);

    playlist.songs.forEach((song, index) => {
      console.log(`${index + 1}. "${song.title}" by "${song.artist}"`);
      console.log(`   Current URL: ${song.youtubeUrl}`);
      console.log();
    });

    console.log(`\n💡 To update a URL, run:`);
    console.log(`   node scripts/updatePlaylistUrls.js ${filePath} <song-number> "<new-url>"`);
    console.log(`\n   Example:`);
    console.log(`   node scripts/updatePlaylistUrls.js ${filePath} 1 "https://www.youtube.com/watch?v=NEW_VIDEO_ID"`);
  } catch (error) {
    console.error("Error reading playlist:", error.message);
    process.exit(1);
  }
}

// Main
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log("Usage:");
  console.log("  Interactive mode: node scripts/updatePlaylistUrls.js <playlist-file>");
  console.log("  Update URL: node scripts/updatePlaylistUrls.js <playlist-file> <song-index> <new-url>");
  console.log("\nExample:");
  console.log('  node scripts/updatePlaylistUrls.js daily-playlists/chinese/2025-11-12.json 0 "https://www.youtube.com/watch?v=REAL_ID"');
  process.exit(1);
}

const filePath = args[0];

if (args.length === 1) {
  // Interactive mode - just show the playlist
  interactiveMode(filePath);
} else if (args.length === 3) {
  // Update mode
  const songIndex = parseInt(args[1], 10);
  const newUrl = args[2];

  if (isNaN(songIndex)) {
    console.error("Song index must be a number");
    process.exit(1);
  }

  updatePlaylistUrl(filePath, songIndex, newUrl);
} else {
  console.error("Invalid arguments");
  process.exit(1);
}

