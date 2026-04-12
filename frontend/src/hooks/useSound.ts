import { Howl } from 'howler';
import { useStore } from '../store/useStore';

const sounds: Record<string, Howl> = {};
const lastPlayed: Record<string, number> = {};
const DEDUP_MS = 100;

// Map sound name → list of numbered file variants
const SOUND_VARIANTS: Record<string, number> = {
  card_received: 1,
  your_turn: 1,
  fold: 1,
  check: 3,
  allin: 2,
  raise: 1,
  win: 1,
  lose: 1,
  stalling: 1,
  blinds_up: 1,
  rebuy: 1,
  kick: 1,
};

function getSoundFile(name: string): string {
  const count = SOUND_VARIANTS[name] || 1;
  const variant = Math.floor(Math.random() * count) + 1;
  return `/sounds/${name}_${variant}.mp3`;
}

function getSound(name: string, file: string): Howl {
  if (!sounds[file]) {
    sounds[file] = new Howl({
      src: [file],
      volume: 0.7,
      preload: true,
    });
  }
  return sounds[file];
}

export function playSound(name: string) {
  const state = useStore.getState();
  if (state.soundMuted) return;

  const now = Date.now();
  if (lastPlayed[name] && now - lastPlayed[name] < DEDUP_MS) return;
  lastPlayed[name] = now;

  const file = getSoundFile(name);
  const sound = getSound(name, file);
  sound.volume(state.soundVolume);
  sound.play();
}

export function setGlobalVolume(volume: number) {
  Object.values(sounds).forEach((s) => s.volume(volume));
}
