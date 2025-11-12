import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import OpenAI from "openai";

const REQUIRED_SONG_COUNT = 5;
const OUTPUT_FOLDER = "daily-playlists";
const PLAYLIST_VARIANTS = [
  {
    key: "chinese",
    outputSubdir: "chinese",
    displayLabel: "Chinese",
    systemAppend:
      "For this playlist you must only select Chinese-language songs (Mandarin, Cantonese, or other Chinese dialects) performed by well-known Chinese artists. These should be popular songs that are widely recognized in Chinese-speaking communities.",
    userAppend:
      "Ensure every correct song and wrong choice is a Chinese-language track (Mandarin, Cantonese, or other Chinese dialects) performed by well-known Chinese artists that are popular and recognizable. CRITICAL: All YouTube URLs must be accessible from Malaysia/Southeast Asia region. Only use videos that are not region-blocked in Malaysia.",
  },
];
// Model selection - try these in order:
// 1. "gpt-5" (if available via API)
// 2. "o1" or "o1-preview" (if available)
// 3. "gpt-4o-2024-08-06" (latest GPT-4o)
// 4. "gpt-4o" (fallback)
// Update this to match what ChatGPT is using
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-2024-08-06";
const MAX_THEME_ATTEMPTS = 3;
const THEME_COOLDOWN_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

function normalizeTheme(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function dedupeThemes(themes) {
  const seen = new Set();
  const result = [];
  for (const theme of themes) {
    if (!theme) continue;
    const normalized = normalizeTheme(theme);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(theme.trim());
  }
  return result;
}

function parseDateString(value) {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function daysBetween(laterDate, earlierDate) {
  if (!(laterDate instanceof Date) || !(earlierDate instanceof Date)) {
    return Number.POSITIVE_INFINITY;
  }
  const diff = laterDate.getTime() - earlierDate.getTime();
  return diff / MS_PER_DAY;
}

function normalizeHexColor(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!HEX_COLOR_REGEX.test(trimmed)) {
    return null;
  }
  return trimmed.toUpperCase();
}

function sanitizeThemeGradient(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const from = normalizeHexColor(value.from);
  const to = normalizeHexColor(value.to);
  let via = normalizeHexColor(value.via);

  if (!from || !to) {
    return null;
  }

  if (!via) {
    via = from;
  }
  const angle =
    typeof value.angle === "string" && value.angle.trim().length > 0
      ? value.angle.trim()
      : "to right";

  return { from, via, to, angle };
}

function parseStartTimeToSeconds(value) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value !== "string") {
    return Number.NaN;
  }
  const parts = value.trim().split(":");
  if (parts.length !== 2) {
    return Number.NaN;
  }
  const minutes = Number(parts[0]);
  const seconds = Number(parts[1]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return Number.NaN;
  }
  return minutes * 60 + seconds;
}

function formatSecondsToTimestamp(totalSeconds) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function extractYouTubeVideoId(url) {
  if (!url || typeof url !== "string") return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.slice(1) || null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      return parsed.searchParams.get("v");
    }
  } catch {
    // fall through to regex
  }
  const match = url.match(/(?:v=|\/watch\/|youtu\.be\/|embed\/)([0-9A-Za-z_-]{11})/);
  return match ? match[1] : null;
}

function validateYouTubeUrl(url) {
  if (!url || typeof url !== "string") {
    return { valid: false, reason: "URL is missing or invalid type" };
  }
  
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    return { valid: false, reason: "Could not extract video ID from URL" };
  }
  
  // YouTube video IDs are typically 11 characters
  if (videoId.length !== 11) {
    return { valid: false, reason: `Video ID length is ${videoId.length}, expected 11` };
  }
  
  // Check for common invalid patterns
  if (videoId.includes(" ") || videoId.includes("%")) {
    return { valid: false, reason: "Video ID contains invalid characters" };
  }
  
  return { valid: true, videoId };
}

async function checkYouTubeVideoExists(videoId) {
  if (!videoId || videoId.length !== 11) {
    return { exists: false, reason: "Invalid video ID format" };
  }

  try {
    // Use YouTube oEmbed API to check if video exists
    // This is a lightweight way to verify video availability
    // Note: This may fail due to region restrictions or rate limiting, so we treat failures as "unknown" not "invalid"
    const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(oEmbedUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(8000), // 8 second timeout
    });

    if (!response.ok) {
      // 404 means video doesn't exist, but other errors might be region/rate limiting
      if (response.status === 404) {
        return { exists: false, reason: `Video not found (HTTP 404)` };
      }
      // 403, 429, etc. might be region blocks or rate limits - treat as unknown
      if (response.status === 403 || response.status === 429) {
        console.warn(`Video ${videoId} returned HTTP ${response.status} - might be region-blocked or rate-limited`);
        return { exists: null, reason: `HTTP ${response.status} - possibly region-blocked or rate-limited` };
      }
      return { exists: null, reason: `HTTP error ${response.status} - cannot verify` };
    }

    const data = await response.json();
    if (data && data.html) {
      return { exists: true, title: data.title || null };
    }
    
    return { exists: null, reason: "Invalid response from YouTube - cannot verify" };
  } catch (error) {
    if (error.name === "AbortError") {
      return { exists: null, reason: "Request timeout - cannot verify" };
    }
    if (error.message?.includes("404") || error.message?.includes("not found")) {
      return { exists: false, reason: "Video not found" };
    }
    // Network errors, timeouts, etc. - treat as unknown, not invalid
    console.warn(`Could not verify video ${videoId}: ${error.message}`);
    return { exists: null, reason: `Verification failed: ${error.message}` };
  }
}


async function loadExistingThemes(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const themes = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    try {
      const contents = await readFile(path.join(directory, entry.name), "utf8");
      const parsed = JSON.parse(contents);
      if (parsed?.theme) {
        const theme = String(parsed.theme);
        const date =
          typeof parsed.date === "string"
            ? parsed.date
            : entry.name.replace(/\.json$/i, "");
        themes.push({ theme, date });
      }
    } catch (error) {
      console.warn(
        `Unable to read existing playlist file ${entry.name}:`,
        error?.message ?? error
      );
    }
  }
  return themes;
}

function buildUserPrompt({ today, bannedThemes, variantInstruction }) {
  const safeBannedThemes = Array.isArray(bannedThemes) ? bannedThemes : [];
  const promptParts = [
    `Generate today's playlist for ${today}.`,
    "Propose a crowd-pleasing, widely understood theme (e.g., 'Ultimate Karaoke Classics', '90s Chinese Pop Hits', 'Mandopop Ballads') that ties well-known Chinese songs together.",
    "Include a short description for each highlighted section explaining how it supports the theme, and confirm the chosen timestamp lands inside an instantly recognisable vocal or instrumental hook (not silence).",
    "Each of the five songs is the correct answer for its own round, and each song must include a wrongChoices array with exactly seven popular but incorrect Chinese songs that fit the theme without duplicating the correct title or each other.",
    "CRITICAL: None of the wrong choices in any song's wrongChoices array can match any of the five correct answer songs. Each wrong choice must be completely different from all five correct answers (by both title and artist). You can choose any other random Chinese songs that fit the theme as wrong choices - they just must not be any of the five correct answers.",
    "Avoid reusing any song (correct or incorrect) across different arrays.",
    "Each song entry must include title, artist, youtubeUrl, sectionLabel, startTime, wrongChoices, and any optional context fields allowed by the schema.",
    "Respond with valid JSON only. The JSON must have a 'theme' string, a 'songs' array with exactly 5 objects, and a 'themeGradient' object.",
    "Each song object must have: title, artist, youtubeUrl, sectionLabel, startTime (format: 'M:SS' or 'MM:SS'), and wrongChoices (array of 7 objects with title and artist).",
    "CRITICAL: Only include YouTube URLs that you are CERTAIN exist. If you're not sure about a URL, choose a different song that you know has a working YouTube video.",
  ];

  if (safeBannedThemes.length > 0) {
    const formatted = safeBannedThemes.map((theme) => `"${theme}"`).join(", ");
    promptParts.splice(
      1,
      0,
      `Avoid repeating any of these previously used themes: ${formatted}.`
    );
  }

  if (variantInstruction) {
    promptParts.splice(1, 0, variantInstruction);
  }

  promptParts.push(
    "Provide a themeGradient object that captures the theme's vibe using linear-gradient stops: include `from`, `via`, `to` hex colours (e.g., '#FFAA33') and an `angle` (e.g., 'to right')."
  );
  promptParts.push(
    "YouTube URLs: Provide working YouTube URLs for each song. Use official videos from artist channels or music labels. Ensure videos are accessible from Malaysia/Southeast Asia. Only include URLs you know exist - do not guess video IDs."
  );
  promptParts.push(
    "Select timestamps that are at least 15 seconds into the track and leave at least 20 seconds before the ending; highlight a dense musical moment, not sparse or silent sections."
  );
  promptParts.push(
    "CRITICAL: Only select YouTube videos that are the actual song itself. Reject any videos that contain long non-song content such as: extended intros, outros, interviews, behind-the-scenes footage, live concert introductions, extended music video narratives, or any content before/after the actual song that exceeds 10 seconds. The video must start playing the actual song within the first 10 seconds, and the song must be the primary content of the video."
  );

  return promptParts.join(" ");
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error(
      "Missing OPENAI_API_KEY. Set it in your environment before running this script."
    );
    process.exit(1);
  }

  const client = new OpenAI({ apiKey });

  const today = new Date().toISOString().slice(0, 10);
  const generatedAt = new Date().toISOString();
  const playlistSchema = {
    type: "object",
    additionalProperties: false,
    required: ["theme", "songs", "themeGradient"],
    properties: {
      theme: {
        type: "string",
        description: "A short, enticing theme that connects the five selected Chinese songs.",
      },
      songs: {
        type: "array",
        minItems: REQUIRED_SONG_COUNT,
        maxItems: REQUIRED_SONG_COUNT,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "artist", "youtubeUrl", "sectionLabel", "startTime", "wrongChoices"],
          properties: {
            title: {
              type: "string",
              description: "Exact song title for a popular Chinese-language track.",
            },
            artist: {
              type: "string",
              description: "Primary performing artist (Chinese artist name).",
            },
            youtubeUrl: {
              type: "string",
              description:
                "CRITICAL - Playable YouTube URL Requirements: Must be a verified, working YouTube URL that can be embedded and played in an iframe player, and MUST be accessible from Malaysia/Southeast Asia. The video MUST: (1) Exist and be publicly accessible, (2) Allow embedding (not have embedding disabled), (3) NOT be region-blocked in Malaysia/Southeast Asia - must be accessible from Malaysia, Singapore, Taiwan, Hong Kong, (4) Not require sign-in or age verification, (5) Be the actual official song by the specified artist (not covers, remixes, or different songs), (6) Start playing the song within 10 seconds. REGION REQUIREMENT: Videos must be accessible from Malaysia. STRONGLY prefer: Official artist YouTube channels, official music label channels (Warner Music Taiwan, Universal Music Taiwan, Sony Music Taiwan, etc.), verified music video uploads that are known to work in Malaysia. AVOID: Lyric videos, fan uploads, covers, region-blocked videos (especially those blocked in Malaysia), deleted videos, videos with embedding disabled, or any unofficial sources. Before including any URL, verify it works in an iframe embed player and is accessible from Malaysia.",
              pattern:
                "^(https?:\\/\\/(www\\.)?youtube\\.com\\/watch\\?v=[A-Za-z0-9_-]{6,}|https?:\\/\\/(music\\.)?youtube\\.com\\/watch\\?v=[A-Za-z0-9_-]{6,}|https?:\\/\\/youtu\\.be\\/[A-Za-z0-9_-]{6,})$",
            },
            sectionLabel: {
              type: "string",
              description:
                "Name of the highlighted section (e.g., 'opening verse', 'rap bridge', 'final chorus').",
            },
            startTime: {
              type: "string",
              pattern: "^\\d{1,2}:\\d{2}$",
              description:
                "Timestamp (MM:SS or M:SS) where the highlighted section should begin playing.",
            },
            wrongChoices: {
              type: "array",
              minItems: 7,
              maxItems: 7,
              description:
                "Exactly seven alternative Chinese song titles that are plausible but incorrect answers for this round.",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["title", "artist"],
                properties: {
                  title: {
                    type: "string",
                    description: "Title of the incorrect but theme-aligned Chinese song choice.",
                  },
                  artist: {
                    type: "string",
                    description: "Primary performing artist of the incorrect choice (Chinese artist name).",
                  },
                },
              },
            },
          },
        },
      },
      themeGradient: {
        type: "object",
        additionalProperties: false,
        required: ["from", "via", "to", "angle"],
        properties: {
          from: {
            type: "string",
            pattern: "^#[0-9A-Fa-f]{6}$",
            description: "Hex color for the gradient starting point (e.g., '#FFAA33').",
          },
          via: {
            type: "string",
            pattern: "^#[0-9A-Fa-f]{6}$",
            description: "Middle hex color stop for the gradient.",
          },
          to: {
            type: "string",
            pattern: "^#[0-9A-Fa-f]{6}$",
            description: "Hex color for the gradient ending point.",
          },
          angle: {
            type: "string",
            description:
              "CSS linear-gradient direction (e.g., 'to right', '135deg').",
          },
        },
      },
    },
  };

  const todayDateObj = parseDateString(today);
  const baseSystemPrompt = [
    "You are a music curator with deep knowledge of popular Chinese music (Mandarin, Cantonese, and other Chinese dialects) across genres and eras.",
    "Curate playlists that feel cohesive and surprise the listener with thoughtful choices.",
    "Only select widely recognised Chinese songs (no covers or obscure recordings).",
    "Return exactly five distinct Chinese songs every time.",
    "CRITICAL - YouTube URLs: Only provide YouTube URLs for songs that you know have official videos on YouTube.",
    "Use URLs from well-known, popular Chinese songs that definitely have official YouTube videos.",
    "Prefer official artist channels and music label channels.",
    "Do not make up or guess video IDs - only use URLs you know exist.",
    "REGION REQUIREMENT: Videos MUST be accessible from Malaysia and Southeast Asia region. Prioritize videos that are available in Malaysia, Singapore, Taiwan, Hong Kong, and other Southeast Asian countries.",
    "For Chinese music, prioritize:",
    "1. Official artist YouTube channels (e.g., 周杰倫 Jay Chou Official Channel, 陳奕迅 Eason Chan Official, 田馥甄 Hebe Tien Official)",
    "2. Official music label channels (e.g., Warner Music Taiwan, Universal Music Taiwan, Sony Music Taiwan, JVR Music, Rock Records)",
    "3. Verified music video uploads from official sources that explicitly allow embedding",
    "4. Videos uploaded to YouTube Music or official channels that are accessible in Malaysia/Southeast Asia",
    "5. CRITICAL REQUIREMENTS - Each URL must:",
    "   a. ACTUALLY EXIST - You must have verified the video exists before including the URL (do not guess IDs)",
    "   b. Be publicly accessible (not deleted or private)",
    "   c. Allow embedding in iframes (embedding must be enabled by the uploader)",
    "   d. NOT be region-blocked in Malaysia and Southeast Asia (MUST be accessible from Malaysia, Singapore, Taiwan, Hong Kong)",
    "   e. Not require sign-in, age verification, or any authentication",
    "   f. Be the actual official song by the specified artist (not covers, remixes, live versions with long intros, or different songs)",
    "   g. Start playing the actual song within the first 10 seconds",
    "6. STRICTLY AVOID: lyric videos, fan uploads, covers, region-blocked videos (especially those blocked in Malaysia/Southeast Asia), deleted/removed videos, videos with embedding disabled, age-restricted videos, or any unofficial sources",
    "7. BEFORE including any YouTube URL, you MUST verify: (a) the video actually exists by checking YouTube, (b) it works in an iframe embed player, (c) it's not blocked in Malaysia/Southeast Asia, (d) it's accessible from the Malaysia region",
    "8. If you cannot find a verified, working, embeddable YouTube URL for a song that is accessible from Malaysia, you MUST choose a different track instead",
    "9. IMPORTANT: Only use URLs you have actually seen and verified exist. Do not generate or guess video IDs.",
    "10. REGION PRIORITY: When selecting videos, prioritize those that are known to work in Malaysia. Many Chinese music videos are uploaded to official channels that are accessible worldwide including Malaysia.",
    "CRITICAL: Only select YouTube videos where the actual song starts playing within the first 10 seconds. Reject videos with extended introductions, interviews, behind-the-scenes content, or any non-song material before the music begins. The video must be primarily the song itself, not a documentary, interview, or extended music video narrative.",
    "Choose a section that already has audio; avoid cold intros, silence, or outros with fade-outs.",
    "Highlight a memorable 45-90 second section for each song and provide the start timestamp. The timestamp must not be within the first 15 seconds or the final 20 seconds of the track, and it must land on a rich, energetic moment (no sparse instrumentation or rests).",
    "Themes must be instantly recognisable and broad (e.g., 'Ultimate Karaoke Classics', '90s Chinese Pop Hits', 'Mandopop Ballads'). Avoid obscure or niche framing.",
    "When selecting genres, artists, and songs, prioritise mainstream, chart-validated hits and well-known Chinese performers; never rely on niche subgenres, underground acts, or deep cuts.",
    "Every song you return is a correct answer; additionally provide seven plausible but incorrect alternatives for each song.",
    "CRITICAL: Ensure that none of the wrong choices in any song's wrongChoices array match any of the five correct answer songs. Each wrong choice must be completely distinct from all five correct answers (check both title and artist). You can choose any other random Chinese songs that fit the theme as wrong choices - they just must not be any of the five correct answers.",
    "Song titles and artist names can be in Chinese characters (simplified or traditional), pinyin, or a combination. Use the most commonly recognized form.",
    "Return a themeGradient object describing a linear gradient that visually matches the stated theme, using only six-digit hex colours for from, via, and to, plus an angle (e.g., 'to right', '135deg').",
  ].join(" ");

  for (const variant of PLAYLIST_VARIANTS) {
    const outputDir = path.resolve(process.cwd(), OUTPUT_FOLDER, variant.outputSubdir);
    const outputPath = path.join(outputDir, `${today}.json`);

    await mkdir(outputDir, { recursive: true });

    try {
      await access(outputPath, fsConstants.F_OK);
      console.log(
        `Playlist for ${today} (${variant.displayLabel}) already exists at ${outputPath}. Skipping.`
      );
      continue;
    } catch {
      // File does not exist; continue.
    }

    const previousThemeEntries = await loadExistingThemes(outputDir);
    const latestUsageByTheme = new Map();

    for (const entry of previousThemeEntries) {
      const normalized = normalizeTheme(entry.theme);
      if (!normalized) continue;
      const parsedDate = parseDateString(entry.date);
      if (!parsedDate) continue;
      const existing = latestUsageByTheme.get(normalized);
      if (!existing || parsedDate > existing.date) {
        latestUsageByTheme.set(normalized, { display: entry.theme.trim(), date: parsedDate });
      }
    }

    const cooldownThemes = [];
    const cooldownNormalizedSet = new Set();

    latestUsageByTheme.forEach(({ display, date }, normalized) => {
      if (!todayDateObj) return;
      const diffDays = daysBetween(todayDateObj, date);
      if (diffDays < THEME_COOLDOWN_DAYS) {
        cooldownThemes.push(display);
        cooldownNormalizedSet.add(normalized);
      }
    });

    const recentThemes = dedupeThemes(cooldownThemes);
    const usedThemeSet = new Set(cooldownNormalizedSet);

    const systemPromptParts = [baseSystemPrompt];
    if (variant.systemAppend) {
      systemPromptParts.push(variant.systemAppend);
    }
    const systemPrompt = systemPromptParts.join(" ");

    const attemptedThemes = [];
    let parsedPayload;

    for (let attempt = 0; attempt < MAX_THEME_ATTEMPTS; attempt += 1) {
      const bannedList = dedupeThemes([...recentThemes, ...attemptedThemes]).slice(-12);
      const userPrompt = buildUserPrompt({
        today,
        bannedThemes: bannedList,
        variantInstruction: variant.userAppend,
      });

      let response;
      try {
        // Use the standard chat.completions API (same as ChatGPT)
        // Try without strict JSON schema first - let the model respond more naturally like ChatGPT
        response = await client.chat.completions.create({
          model: MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          // Use json_object instead of strict json_schema to be more flexible like ChatGPT
          response_format: {
            type: "json_object",
          },
        });
      } catch (error) {
        console.error(
          `Failed to generate ${variant.displayLabel.toLowerCase()} playlist with OpenAI:`,
          error
        );
        // If model not found, suggest alternatives
        if (error.message?.includes("model") || error.status === 404) {
          console.error(`\n💡 Model "${MODEL}" may not be available. Try:`);
          console.error(`   - Set OPENAI_MODEL environment variable: export OPENAI_MODEL="gpt-4o"`);
          console.error(`   - Or edit the MODEL constant in the script`);
          console.error(`   - Available models: gpt-4o, gpt-4o-2024-08-06, gpt-4-turbo`);
        }
        process.exitCode = 1;
        return;
      }

      // Extract the JSON content from the standard API response
      const outputText = response.choices?.[0]?.message?.content?.trim();

      if (!outputText) {
        console.error("OpenAI response did not include JSON output.");
        console.error("Full response:", JSON.stringify(response, null, 2));
        process.exitCode = 1;
        return;
      }

      // Debug: Log the raw response to see what URLs were generated
      console.log("\n📋 Raw API Response (first 500 chars):", outputText.substring(0, 500));
      
      try {
        parsedPayload = JSON.parse(outputText);
        
        // Debug: Log the URLs that were generated
        if (parsedPayload.songs && Array.isArray(parsedPayload.songs)) {
          console.log("\n🔍 Generated YouTube URLs:");
          parsedPayload.songs.forEach((song, idx) => {
            console.log(`  ${idx + 1}. ${song.title} by ${song.artist}: ${song.youtubeUrl}`);
          });
        }
      } catch (error) {
        console.error("Failed to parse JSON from OpenAI response:", error);
        console.error("Raw response:", outputText);
        process.exitCode = 1;
        return;
      }

      const theme = typeof parsedPayload.theme === "string" ? parsedPayload.theme.trim() : "";
      const normalizedTheme = normalizeTheme(theme);
      const isDuplicateTheme = normalizedTheme && usedThemeSet.has(normalizedTheme);

      if (theme && isDuplicateTheme) {
        console.warn(
          `Received a previously used theme "${theme}". Attempt ${attempt + 1} of ${MAX_THEME_ATTEMPTS}.`
        );
        attemptedThemes.push(theme);
        if (attempt === MAX_THEME_ATTEMPTS - 1) {
          console.warn(
            "Maximum attempts reached; proceeding with potentially repeated theme."
          );
          break;
        }
        continue;
      }

      if (normalizedTheme) {
        usedThemeSet.add(normalizedTheme);
      }

      break;
    }

    if (!parsedPayload) {
      console.error("Failed to generate playlist payload.");
      process.exitCode = 1;
      return;
    }

    const sanitizedGradient = sanitizeThemeGradient(parsedPayload.themeGradient);
    if (sanitizedGradient) {
      parsedPayload.themeGradient = sanitizedGradient;
    } else {
      delete parsedPayload.themeGradient;
    }

    if (!Array.isArray(parsedPayload.songs)) {
      console.warn("OpenAI response did not include a songs array. Saving raw payload.");
    } else if (parsedPayload.songs.length !== REQUIRED_SONG_COUNT) {
      console.warn(
        `Expected ${REQUIRED_SONG_COUNT} songs but received ${parsedPayload.songs.length}. Saving anyway.`
      );
    }

    // Validate all YouTube URLs exist before proceeding
    if (Array.isArray(parsedPayload.songs)) {
      console.log("\n🔍 Validating YouTube video URLs...");
      const invalidVideos = [];
      
      for (let index = 0; index < parsedPayload.songs.length; index++) {
        const song = parsedPayload.songs[index];
        if (song.youtubeUrl) {
          const urlValidation = validateYouTubeUrl(song.youtubeUrl);
          if (!urlValidation.valid) {
            console.error(
              `❌ Song ${index + 1} "${song.title ?? "unknown"}" by "${song.artist ?? "unknown"}" has invalid YouTube URL format: ${urlValidation.reason}. URL: ${song.youtubeUrl}`
            );
            invalidVideos.push({ index, song, reason: urlValidation.reason });
          } else {
            // Check if video actually exists
            console.log(`Checking video ${index + 1}/${parsedPayload.songs.length}: ${song.title}...`);
            const videoCheck = await checkYouTubeVideoExists(urlValidation.videoId);
            
            if (videoCheck.exists === false) {
              console.error(
                `❌ Song ${index + 1} "${song.title ?? "unknown"}" by "${song.artist ?? "unknown"}" - Video does NOT exist: ${videoCheck.reason}. URL: ${song.youtubeUrl}`
              );
              invalidVideos.push({ index, song, reason: videoCheck.reason, videoId: urlValidation.videoId });
            } else if (videoCheck.exists === true) {
              console.log(
                `✓ Song ${index + 1} "${song.title ?? "unknown"}" - Video verified and exists${videoCheck.title ? ` (${videoCheck.title})` : ""} - ID: ${urlValidation.videoId}`
              );
            } else {
              // exists === null means we couldn't verify, but it might still be valid
              // This is common with region blocks or rate limiting
              console.warn(
                `⚠️  Song ${index + 1} "${song.title ?? "unknown"}" - Could not verify video (${videoCheck.reason}). URL: ${song.youtubeUrl}`
              );
              console.warn(
                `   This might be due to region restrictions or API rate limiting. The video may still be valid - please test manually.`
              );
            }
          }
        } else {
          console.error(
            `❌ Song ${index + 1} "${song.title ?? "unknown"}" is missing youtubeUrl`
          );
          invalidVideos.push({ index, song, reason: "Missing youtubeUrl" });
        }
      }
      
      if (invalidVideos.length > 0) {
        console.error(`\n❌ Found ${invalidVideos.length} video(s) that definitely do NOT exist (HTTP 404).`);
        console.error("Invalid videos:");
        invalidVideos.forEach(({ index, song, reason, videoId }) => {
          console.error(`  ${index + 1}. "${song.title}" by "${song.artist}" - ${reason}${videoId ? ` (ID: ${videoId})` : ""}`);
          console.error(`     URL: ${song.youtubeUrl}`);
        });
        console.error("\n⚠️  CRITICAL: The LLM generated invalid video IDs that don't exist.");
        console.error("⚠️  This happens because LLMs cannot verify YouTube URLs in real-time.");
        console.error("⚠️  They generate URLs based on patterns, which may not actually exist.");
        console.error("\n💡 Solutions:");
        console.error("   1. Regenerate the playlist (it may get different URLs)");
        console.error("   2. Manually update URLs using: npm run update:playlist-urls");
        console.error("   3. Use ChatGPT to get working URLs and paste them manually");
        console.error("\n⚠️  The playlist will be saved but these links will not work.\n");
        
        // Don't fail, but warn strongly
        process.exitCode = 1;
      } else {
        console.log("\n✅ No videos returned 404 errors. All URLs appear to be valid.");
        console.log("⚠️  Note: Some videos may not have been verified due to region restrictions or API limits.");
        console.log("⚠️  Please test the URLs manually to ensure they work in your region.\n");
      }
    }
    
    if (Array.isArray(parsedPayload.songs)) {
      parsedPayload.songs = parsedPayload.songs.map((song, index) => {

        let normalizedStartTime = song.startTime;
        const startSeconds = parseStartTimeToSeconds(normalizedStartTime);
        if (Number.isFinite(startSeconds)) {
          if (startSeconds < 15) {
            console.warn(
              `Song "${song.title ?? "unknown"}" startTime ${song.startTime} is too close to the intro. Adjusting to 0:15.`
            );
            normalizedStartTime = formatSecondsToTimestamp(15);
          } else {
            normalizedStartTime = formatSecondsToTimestamp(startSeconds);
          }
        }

        if (!Array.isArray(song.wrongChoices)) {
          console.warn("Song is missing wrongChoices array; defaulting to empty list.");
          return { ...song, startTime: normalizedStartTime, wrongChoices: [] };
        }

        if (song.wrongChoices.length !== 7) {
          console.warn(
            `Expected 7 wrongChoices but received ${song.wrongChoices.length}. Trimming or padding as needed.`
          );
          const trimmed = song.wrongChoices.slice(0, 7);
          while (trimmed.length < 7) {
            trimmed.push({
              title: `Placeholder Option ${trimmed.length + 1}`,
              artist: "TBD Artist",
            });
          }
          return { ...song, startTime: normalizedStartTime, wrongChoices: trimmed };
        }

        return { ...song, startTime: normalizedStartTime };
      });
    }

    const finalPayload = {
      date: today,
      generatedAt,
      model: MODEL,
      variant: variant.key,
      ...parsedPayload,
    };

    await writeFile(outputPath, JSON.stringify(finalPayload, null, 2), "utf8");
    console.log(`\n✅ Saved ${variant.displayLabel.toLowerCase()} playlist for ${today} to ${outputPath}`);
    console.log(`\n⚠️  IMPORTANT: Please verify all YouTube URLs are playable and embeddable:`);
    if (Array.isArray(parsedPayload.songs)) {
      parsedPayload.songs.forEach((song, idx) => {
        if (song.youtubeUrl) {
          const validation = validateYouTubeUrl(song.youtubeUrl);
          if (validation.valid) {
            console.log(`   ${idx + 1}. ${song.title} by ${song.artist}: ${song.youtubeUrl}`);
          }
        }
      });
    }
    console.log(`\n   📝 Testing Instructions:`);
    console.log(`   1. Open each URL in a browser - if it works, the URL is valid`);
    console.log(`   2. Test embedding: Try opening the URL in an iframe or embed player`);
    console.log(`   3. If URLs work in browser but not in the app, it might be:`);
    console.log(`      - Region blocking (videos blocked when embedded vs viewed directly)`);
    console.log(`      - Embedding restrictions (video allows viewing but not embedding)`);
    console.log(`      - YouTube API/player issues in the app`);
    console.log(`   4. Consider using official artist/label channels which typically allow embedding`);
    console.log(`\n   🔧 To update URLs manually (e.g., from ChatGPT):`);
    console.log(`      node scripts/updatePlaylistUrls.js ${outputPath} <song-index> "<new-url>"`);
    console.log(`      Example: node scripts/updatePlaylistUrls.js ${outputPath} 0 "https://www.youtube.com/watch?v=WORKING_ID"`);
    console.log(`      Or run: node scripts/updatePlaylistUrls.js ${outputPath} (to see all songs)\n`);
  }
}

main().catch((error) => {
  console.error("Unexpected error while generating playlist:", error);
  process.exitCode = 1;
});

