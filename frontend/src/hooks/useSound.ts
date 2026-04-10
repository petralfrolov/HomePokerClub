import { Howl } from 'howler';
import { useStore } from '../store/useStore';

const sounds: Record<string, Howl> = {};

const SOUND_FILES: Record<string, string> = {
  card_received: '/sounds/card_received.mp3',
  your_turn: '/sounds/your_turn.mp3',
  fold: '/sounds/fold.mp3',
  check: '/sounds/check.mp3',
  allin: '/sounds/allin.mp3',
  win: '/sounds/win.mp3',
  lose: '/sounds/lose.mp3',
  stalling: '/sounds/stalling.mp3',
  blinds_up: '/sounds/blinds_up.mp3',
  rebuy: '/sounds/rebuy.mp3',
};

function getSound(name: string): Howl {
  if (!sounds[name]) {
    sounds[name] = new Howl({
      src: [SOUND_FILES[name] || `/sounds/${name}.mp3`],
      volume: 0.7,
      preload: true,
    });
  }
  return sounds[name];
}

export function playSound(name: string) {
  const state = useStore.getState();
  if (state.soundMuted) return;

  const sound = getSound(name);
  sound.volume(state.soundVolume);
  sound.play();
}

export function setGlobalVolume(volume: number) {
  Object.values(sounds).forEach((s) => s.volume(volume));
}
