import { StateCreator } from 'zustand';

function getSavedVolume(): number {
  const v = localStorage.getItem('sound_volume');
  const n = v !== null ? parseFloat(v) : 0.7;
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.7;
}

function getSavedMuted(): boolean {
  return localStorage.getItem('sound_muted') === 'true';
}

function getSavedOpponentVolume(): number {
  const v = localStorage.getItem('opponent_sound_volume');
  const n = v !== null ? parseFloat(v) : 0.35;
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.35;
}

function getSavedBool(key: string, def: boolean): boolean {
  const v = localStorage.getItem(key);
  if (v === null) return def;
  return v === 'true';
}

export type HotkeyAction =
  | 'fold'
  | 'checkCall'
  | 'raiseMin'
  | 'raiseConfirm'
  | 'allIn'
  | 'stepUp'
  | 'stepDown'
  | 'away'
  | 'preset1'
  | 'preset2'
  | 'preset3'
  | 'preset4';

export type HotkeyBindings = Record<HotkeyAction, string>;

export const DEFAULT_HOTKEY_BINDINGS: HotkeyBindings = {
  fold: 'f',
  checkCall: 'c',
  raiseMin: 'r',
  raiseConfirm: 'Enter',
  allIn: 'a',
  stepUp: '=',
  stepDown: '-',
  away: 'w',
  preset1: '1',
  preset2: '2',
  preset3: '3',
  preset4: '4',
};

export const DEFAULT_RAISE_PRESETS_BB: [number, number, number, number] = [2.5, 3, 5, 10];

function getSavedBindings(): HotkeyBindings {
  try {
    const raw = localStorage.getItem('hotkey_bindings');
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_HOTKEY_BINDINGS, ...parsed };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_HOTKEY_BINDINGS };
}

function getSavedPresets(): [number, number, number, number] {
  try {
    const raw = localStorage.getItem('raise_presets_bb');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === 4 && parsed.every((x) => Number.isFinite(x) && x > 0)) {
        return parsed as [number, number, number, number];
      }
    }
  } catch { /* ignore */ }
  return [...DEFAULT_RAISE_PRESETS_BB];
}

export type ConnectionStatus = 'idle' | 'connecting' | 'online' | 'reconnecting' | 'offline';

export interface UiSlice {
  // Stalling accused overlay
  stallingAccused: boolean;
  setStallingAccused: (v: boolean) => void;

  // Kicked from table
  kickedCashout: number | null;
  setKicked: (cashout: number) => void;
  clearKicked: () => void;

  // Kicked overlay (shown to kicked player)
  showKickedOverlay: boolean;
  setShowKickedOverlay: (v: boolean) => void;

  // Sound
  soundVolume: number;
  soundMuted: boolean;
  opponentSoundVolume: number;
  setSoundVolume: (v: number) => void;
  setSoundMuted: (v: boolean) => void;
  setOpponentSoundVolume: (v: number) => void;

  // Display mode
  displayInBB: boolean;
  setDisplayInBB: (v: boolean) => void;

  // Personalization
  hotkeysEnabled: boolean;
  vibrateEnabled: boolean;
  confirmAllIn: boolean;
  setHotkeysEnabled: (v: boolean) => void;
  setVibrateEnabled: (v: boolean) => void;
  setConfirmAllIn: (v: boolean) => void;

  // Hotkey customization
  hotkeyBindings: HotkeyBindings;
  setHotkeyBinding: (action: HotkeyAction, key: string) => void;
  resetHotkeyBindings: () => void;
  raisePresetsBB: [number, number, number, number];
  setRaisePresetBB: (index: 0 | 1 | 2 | 3, value: number) => void;
  resetRaisePresetsBB: () => void;

  // Connection status
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (s: ConnectionStatus) => void;
}

export const createUiSlice: StateCreator<UiSlice, [], [], UiSlice> = (set) => ({
  stallingAccused: false,
  setStallingAccused: (v) => set({ stallingAccused: v }),

  kickedCashout: null,
  setKicked: (cashout) => set({ kickedCashout: cashout }),
  clearKicked: () => set({ kickedCashout: null }),

  showKickedOverlay: false,
  setShowKickedOverlay: (v) => set({ showKickedOverlay: v }),

  soundVolume: getSavedVolume(),
  soundMuted: getSavedMuted(),
  opponentSoundVolume: getSavedOpponentVolume(),
  setSoundVolume: (v) => {
    localStorage.setItem('sound_volume', String(v));
    set({ soundVolume: v });
  },
  setSoundMuted: (v) => {
    localStorage.setItem('sound_muted', String(v));
    set({ soundMuted: v });
  },
  setOpponentSoundVolume: (v) => {
    localStorage.setItem('opponent_sound_volume', String(v));
    set({ opponentSoundVolume: v });
  },

  displayInBB: localStorage.getItem('display_in_bb') === 'true',
  setDisplayInBB: (v) => {
    localStorage.setItem('display_in_bb', String(v));
    set({ displayInBB: v });
  },

  hotkeysEnabled: getSavedBool('hotkeys_enabled', true),
  vibrateEnabled: getSavedBool('vibrate_enabled', true),
  confirmAllIn: getSavedBool('confirm_allin', true),
  setHotkeysEnabled: (v) => {
    localStorage.setItem('hotkeys_enabled', String(v));
    set({ hotkeysEnabled: v });
  },
  setVibrateEnabled: (v) => {
    localStorage.setItem('vibrate_enabled', String(v));
    set({ vibrateEnabled: v });
  },
  setConfirmAllIn: (v) => {
    localStorage.setItem('confirm_allin', String(v));
    set({ confirmAllIn: v });
  },

  hotkeyBindings: getSavedBindings(),
  setHotkeyBinding: (action, key) => set((state) => {
    const next = { ...state.hotkeyBindings, [action]: key };
    localStorage.setItem('hotkey_bindings', JSON.stringify(next));
    return { hotkeyBindings: next };
  }),
  resetHotkeyBindings: () => {
    localStorage.removeItem('hotkey_bindings');
    set({ hotkeyBindings: { ...DEFAULT_HOTKEY_BINDINGS } });
  },
  raisePresetsBB: getSavedPresets(),
  setRaisePresetBB: (index, value) => set((state) => {
    const next = [...state.raisePresetsBB] as [number, number, number, number];
    next[index] = value;
    localStorage.setItem('raise_presets_bb', JSON.stringify(next));
    return { raisePresetsBB: next };
  }),
  resetRaisePresetsBB: () => {
    localStorage.removeItem('raise_presets_bb');
    set({ raisePresetsBB: [...DEFAULT_RAISE_PRESETS_BB] });
  },

  connectionStatus: 'idle',
  setConnectionStatus: (s) => set({ connectionStatus: s }),
});
