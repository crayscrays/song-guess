import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import OpenAI from "openai";

const REQUIRED_SONG_COUNT = 5;
const OUTPUT_FOLDER = "daily-playlists";
const PLAYLIST_VARIANTS = [
  {
    key: "english",
    outputSubdir: "english",
    displayLabel: "English",
    systemAppend:
      "For this playlist you must only select English-language songs performed by globally recognised artists. Avoid non-English tracks.",
    userAppend:
      "Ensure every correct song and wrong choice is an English-language track that is globally recognisable.",
  },
];
const MODEL = "gpt-4.1-mini";
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
    "Propose a crowd-pleasing, widely understood theme (e.g., 'Back to the 90s', 'Top EDM Anthems', 'Ultimate Karaoke Classics') that ties globally famous songs together.",
    "Include a short description for each highlighted section explaining how it supports the theme, and confirm the chosen timestamp lands inside an instantly recognisable vocal or instrumental hook (not silence).",
    "Each of the five songs is the correct answer for its own round, and each song must include a wrongChoices array with exactly seven globally popular but incorrect songs that fit the theme without duplicating the correct title or each other.",
    "CRITICAL: None of the wrong choices in any song's wrongChoices array can match any of the five correct answer songs. Each wrong choice must be completely different from all five correct answers (by both title and artist). You can choose any other random songs that fit the theme as wrong choices - they just must not be any of the five correct answers.",
    "Avoid reusing any song (correct or incorrect) across different arrays.",
    "Each song entry must include title, artist, youtubeUrl, sectionLabel, startTime, wrongChoices, and any optional context fields allowed by the schema.",
    "Respond strictly with JSON matching the provided schema.",
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
    "Make sure every YouTube link is fully embeddable in an iframe without requiring sign-in, and reject any option that blocks embedding."
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
        description: "A short, enticing theme that connects the five selected songs.",
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
              description: "Exact song title for a globally popular track.",
            },
            artist: {
              type: "string",
              description: "Primary performing artist.",
            },
            youtubeUrl: {
              type: "string",
              description:
                "Direct link to a high-quality YouTube video for the track (avoid lyric videos or fan cams when possible).",
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
                "Exactly seven alternative song titles that are plausible but incorrect answers for this round.",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["title", "artist"],
                properties: {
                  title: {
                    type: "string",
                    description: "Title of the incorrect but theme-aligned song choice.",
                  },
                  artist: {
                    type: "string",
                    description: "Primary performing artist of the incorrect choice.",
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
    "You are a music curator with deep knowledge of globally popular music across genres and eras.",
    "Curate playlists that feel cohesive and surprise the listener with thoughtful choices.",
    "Only select widely recognised songs (no covers or obscure recordings).",
    "Return exactly five distinct songs every time.",
    "Prefer official music videos or reputable uploads for YouTube links.",
    "If you cannot find a high-quality YouTube link for a song, choose a different track.",
    "Never pick videos that block iframe playback (no VEVO regional blocks, no restricted live streams). Ensure every YouTube link is embed-friendly in standard iframes without requiring sign-in.",
    "CRITICAL: Only select YouTube videos where the actual song starts playing within the first 10 seconds. Reject videos with extended introductions, interviews, behind-the-scenes content, or any non-song material before the music begins. The video must be primarily the song itself, not a documentary, interview, or extended music video narrative.",
    "Choose a section that already has audio; avoid cold intros, silence, or outros with fade-outs.",
    "Highlight a memorable 45-90 second section for each song and provide the start timestamp. The timestamp must not be within the first 15 seconds or the final 20 seconds of the track, and it must land on a rich, energetic moment (no sparse instrumentation or rests).",
    "Themes must be instantly recognisable and broad (e.g., 'Back to the 90s', 'Top EDM Anthems', 'Sunday Morning Chill'). Avoid obscure or niche framing.",
    "When selecting genres, artists, and songs, prioritise mainstream, chart-validated hits and globally famous performers; never rely on niche subgenres, underground acts, or deep cuts.",
    "Every song you return is a correct answer; additionally provide seven plausible but incorrect alternatives for each song.",
    "CRITICAL: Ensure that none of the wrong choices in any song's wrongChoices array match any of the five correct answer songs. Each wrong choice must be completely distinct from all five correct answers (check both title and artist). You can choose any other random songs that fit the theme as wrong choices - they just must not be any of the five correct answers.",
    "Ensure all JSON fields are filled in using standard Latin characters.",
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
        response = await client.responses.create({
          model: MODEL,
          input: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          text: {
            format: {
              type: "json_schema",
              name: "daily_playlist",
              schema: playlistSchema,
            },
          },
        });
      } catch (error) {
        console.error(
          `Failed to generate ${variant.displayLabel.toLowerCase()} playlist with OpenAI:`,
          error
        );
        process.exitCode = 1;
        return;
      }

      const outputText =
        response.output_text ??
        response.output
          ?.flatMap((item) => item.content ?? [])
          .flatMap((content) => ("text" in content ? content.text : ""))
          .join("")
          .trim();

      if (!outputText) {
        console.error("OpenAI response did not include JSON output.");
        process.exitCode = 1;
        return;
      }

      try {
        parsedPayload = JSON.parse(outputText);
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

    if (Array.isArray(parsedPayload.songs)) {
      parsedPayload.songs = parsedPayload.songs.map((song) => {
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
    console.log(`Saved ${variant.displayLabel.toLowerCase()} playlist for ${today} to ${outputPath}`);
  }
}

main().catch((error) => {
  console.error("Unexpected error while generating playlist:", error);
  process.exitCode = 1;
});


