import { Howl } from 'howler';
import { useStore } from '../store/useStore';

// Import all sound files via glob — Vite adds a content hash to each filename,
// so browsers automatically invalidate the cache whenever a file changes.
const soundModules = import.meta.glob('../assets/sounds/*.mp3', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

// Build a lookup: "check_1" → hashed URL like "/assets/sounds/check_1.a3f8b2.mp3"
const SOUND_URLS: Record<string, string> = {};
for (const [filePath, url] of Object.entries(soundModules)) {
  const key = filePath.replace(/.*\//, '').replace(/\.mp3$/, ''); // e.g. "check_1"
  SOUND_URLS[key] = url;
}

// Map sound name → number of numbered file variants
const SOUND_VARIANTS: Record<string, number> = {
  card_received: 1,
  your_turn: 1,
  fold: 2,
  check: 1,
  call: 1,
  allin: 2,
  raise: 2,
  win: 1,
  lose: 1,
  stalling: 2,
  blinds_up: 1,
  rebuy: 1,
  kick: 2,
  tips: 1,
  frol_tips: 1,
  player_joined: 1,
  player_left: 1,
  card_dealt: 1,
};

// LRU cache for Howl instances to prevent unbounded growth over long sessions.
const MAX_CACHED_SOUNDS = 32;
const sounds = new Map<string, Howl>();
const lastPlayed: Record<string, number> = {};
const DEDUP_MS = 500;

function touchCache(url: string, sound: Howl) {
  // Move to end (most recently used)
  if (sounds.has(url)) sounds.delete(url);
  sounds.set(url, sound);
  // Evict oldest
  while (sounds.size > MAX_CACHED_SOUNDS) {
    const oldestKey = sounds.keys().next().value as string | undefined;
    if (!oldestKey) break;
    const evicted = sounds.get(oldestKey);
    sounds.delete(oldestKey);
    try {
      evicted?.unload();
    } catch {
      /* ignore */
    }
  }
}

function getSoundUrl(name: string): string {
  const count = SOUND_VARIANTS[name] || 1;
  const variant = Math.floor(Math.random() * count) + 1;
  const key = `${name}_${variant}`;
  return SOUND_URLS[key] ?? `/sounds/${name}_${variant}.mp3`;
}

function getSound(url: string): Howl {
  let sound = sounds.get(url);
  if (!sound) {
    sound = new Howl({
      src: [url],
      volume: 0.7,
      preload: true,
      onloaderror: (_id, err) => {
        console.error(`Sound load error [${url}]:`, err);
        sounds.delete(url);
      },
      onplayerror: (_id, err) => {
        console.error(`Sound play error [${url}]:`, err);
      },
    });
  }
  touchCache(url, sound);
  return sound;
}

export interface PlaySoundOptions {
  /** If true, use `opponentSoundVolume` multiplier (for background events). */
  opponent?: boolean;
  /** Explicit volume multiplier [0..1]. Overrides `opponent`. */
  volumeScale?: number;
  /** Override dedup window (ms); 0 = no dedup. */
  dedupMs?: number;
}

export function playSound(name: string, opts: PlaySoundOptions = {}) {
  const state = useStore.getState();
  if (state.soundMuted) return;

  const dedupWindow = opts.dedupMs ?? DEDUP_MS;
  if (dedupWindow > 0) {
    const now = Date.now();
    if (lastPlayed[name] && now - lastPlayed[name] < dedupWindow) return;
    lastPlayed[name] = now;
  }

  const url = getSoundUrl(name);
  const sound = getSound(url);
  const scale =
    opts.volumeScale !== undefined
      ? opts.volumeScale
      : opts.opponent
        ? state.opponentSoundVolume
        : 1;
  sound.volume(Math.max(0, Math.min(1, state.soundVolume * scale)));
  sound.play();
}

export function setGlobalVolume(volume: number) {
  sounds.forEach((s) => s.volume(volume));
}

/**
 * Unload every cached Howl instance. Call when leaving a table to free memory.
 */
export function unloadAllSounds() {
  sounds.forEach((s) => {
    try {
      s.unload();
    } catch {
      /* ignore */
    }
  });
  sounds.clear();
}
