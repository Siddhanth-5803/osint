// Themes, moods, "tracks" (BPM presets) and caption/hashtag templates.
// Music here is metadata-only (tempo/mood). Exports use beat timing derived
// from BPM, never any third-party audio — see PRODUCT_BLUEPRINT.md §7.

export type Grade =
  | "cinematic"
  | "aesthetic"
  | "vibrant"
  | "warm"
  | "mono"
  | "dreamy";

export type Transition = "crossfade" | "cut" | "zoom" | "slide";

export interface Theme {
  id: string;
  label: string;
  emoji: string;
  grade: Grade;
  beatsPerSlide: number;
  blurb: string;
}

export const THEMES: Theme[] = [
  { id: "cinematic", label: "Cinematic", emoji: "🎬", grade: "cinematic", beatsPerSlide: 4, blurb: "Letterbox, slow push-ins, teal & orange grade." },
  { id: "travel", label: "Travel", emoji: "🌍", grade: "warm", beatsPerSlide: 2, blurb: "Warm tones, whip energy, fast cuts on the beat." },
  { id: "aesthetic", label: "Aesthetic", emoji: "✨", grade: "dreamy", beatsPerSlide: 3, blurb: "Soft dreamy wash, gentle drifts, airy pacing." },
  { id: "comedy", label: "Comedy", emoji: "😂", grade: "vibrant", beatsPerSlide: 1, blurb: "Punchy zooms, meme timing, snappy hard cuts." },
  { id: "romantic", label: "Romantic", emoji: "💗", grade: "warm", beatsPerSlide: 3, blurb: "Warm glow, slow crossfades, tender pacing." },
  { id: "birthday", label: "Birthday", emoji: "🎉", grade: "vibrant", beatsPerSlide: 2, blurb: "Bright, celebratory, confetti energy." },
  { id: "sad", label: "Emotional", emoji: "🥺", grade: "mono", beatsPerSlide: 4, blurb: "Desaturated, slow fades, weighty pauses." },
  { id: "friendship", label: "Friendship", emoji: "🤝", grade: "vibrant", beatsPerSlide: 2, blurb: "Fun, colorful, upbeat montage." },
];

export interface Mood {
  id: string;
  label: string;
  energy: number; // 0..1 — biases BPM and pacing
}

export const MOODS: Mood[] = [
  { id: "chill", label: "Chill", energy: 0.25 },
  { id: "happy", label: "Happy", energy: 0.6 },
  { id: "hype", label: "Hype", energy: 0.95 },
  { id: "dreamy", label: "Dreamy", energy: 0.35 },
  { id: "epic", label: "Epic", energy: 0.8 },
];

export interface Track {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  mood: string;
}

// Royalty-free style presets (metadata only). In production these map to a
// licensed catalog; here they drive beat timing for the preview.
export const TRACKS: Track[] = [
  { id: "t1", title: "Golden Hour", artist: "Free Library", bpm: 90, mood: "warm" },
  { id: "t2", title: "Neon Drive", artist: "Free Library", bpm: 120, mood: "hype" },
  { id: "t3", title: "Soft Focus", artist: "Free Library", bpm: 75, mood: "dreamy" },
  { id: "t4", title: "Festival Lights", artist: "Free Library", bpm: 128, mood: "epic" },
  { id: "t5", title: "Slow Tide", artist: "Free Library", bpm: 68, mood: "sad" },
];

export interface Format {
  id: string;
  label: string;
  w: number;
  h: number;
}

export const FORMATS: Format[] = [
  { id: "reel", label: "Reel · 9:16", w: 1080, h: 1920 },
  { id: "post", label: "Post · 4:5", w: 1080, h: 1350 },
  { id: "square", label: "Square · 1:1", w: 1080, h: 1080 },
  { id: "story", label: "Story · 9:16", w: 1080, h: 1920 },
];

const HASHTAG_BANK: Record<string, string[]> = {
  cinematic: ["cinematic", "filmmaking", "moodyedits", "reelsinstagram", "colorgrading"],
  travel: ["travelreels", "wanderlust", "travelgram", "exploremore", "traveldiaries"],
  aesthetic: ["aesthetic", "aestheticvibes", "softlife", "dailyaesthetic", "moodboard"],
  comedy: ["funnyreels", "memes", "comedyreels", "relatable", "lol"],
  romantic: ["couplegoals", "love", "romantic", "datenight", "ourstory"],
  birthday: ["happybirthday", "birthdayreel", "celebrate", "partytime", "bdayvibes"],
  sad: ["emotional", "deepfeelings", "sadvibes", "healing", "lyrics"],
  friendship: ["friendsforever", "squadgoals", "bestiereel", "goodtimes", "memories"],
};

export function captionFor(themeId: string, prompt: string): string {
  const base: Record<string, string> = {
    cinematic: "Some moments deserve the big-screen treatment. 🎬",
    travel: "Collecting moments, not things. ✈️🌍",
    aesthetic: "A little soft-life energy for the feed. ✨",
    comedy: "POV: you weren't ready for this one 😂",
    romantic: "You + me + this little montage. 💗",
    birthday: "Another trip around the sun — let's go! 🎉",
    sad: "Holding on to the feeling for a little longer. 🥺",
    friendship: "The crew, doing crew things. 🤝",
  };
  const lead = base[themeId] ?? "Made with Reelio. ✨";
  const tail = prompt.trim() ? ` ${prompt.trim()}` : "";
  return `${lead}${tail}`;
}

export function hashtagsFor(themeId: string): string[] {
  const core = HASHTAG_BANK[themeId] ?? ["reels", "contentcreator", "viral"];
  const evergreen = ["reels", "reelitfeelit", "explorepage", "trending", "fyp"];
  // mix niche + reach tiers, dedupe
  return Array.from(new Set([...core, ...evergreen])).slice(0, 8);
}

// Energy + track combine into an effective BPM for pacing.
export function effectiveBpm(track: Track, energy: number): number {
  const nudge = Math.round((energy - 0.5) * 24); // ±12 bpm
  return Math.max(60, Math.min(140, track.bpm + nudge));
}
