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
  card_received: 2,
  your_turn: 1,
  fold: 2,
  check: 2,
  call: 1,
  allin: 2,
  raise: 2,
  win: 1,
  lose: 2,
  stalling: 2,
  blinds_up: 1,
  rebuy: 1,
  kick: 1,
  tips: 1,
  frol_tips: 1,
};

const sounds: Record<string, Howl> = {};
const lastPlayed: Record<string, number> = {};
const DEDUP_MS = 500;

function getSoundUrl(name: string): string {
  const count = SOUND_VARIANTS[name] || 1;
  const variant = Math.floor(Math.random() * count) + 1;
  const key = `${name}_${variant}`;
  return SOUND_URLS[key] ?? `/sounds/${name}_${variant}.mp3`;
}

function getSound(url: string): Howl {
  if (!sounds[url]) {
    sounds[url] = new Howl({
      src: [url],
      volume: 0.7,
      preload: true,
      onloaderror: (_id, err) => {
        console.error(`Sound load error [${url}]:`, err);
        delete sounds[url];
      },
      onplayerror: (_id, err) => {
        console.error(`Sound play error [${url}]:`, err);
      },
    });
  }
  return sounds[url];
}

export function playSound(name: string) {
  const state = useStore.getState();
  if (state.soundMuted) return;

  const now = Date.now();
  if (lastPlayed[name] && now - lastPlayed[name] < DEDUP_MS) return;
  lastPlayed[name] = now;

  const url = getSoundUrl(name);
  const sound = getSound(url);
  sound.volume(state.soundVolume);
  sound.play();
}

export function setGlobalVolume(volume: number) {
  Object.values(sounds).forEach((s) => s.volume(volume));
}
