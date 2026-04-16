import { StateCreator } from 'zustand';

function getSavedVolume(): number {
  const v = localStorage.getItem('sound_volume');
  return v !== null ? parseFloat(v) : 0.7;
}

function getSavedMuted(): boolean {
  return localStorage.getItem('sound_muted') === 'true';
}

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
  setSoundVolume: (v: number) => void;
  setSoundMuted: (v: boolean) => void;

  // Display mode
  displayInBB: boolean;
  setDisplayInBB: (v: boolean) => void;
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
  setSoundVolume: (v) => {
    localStorage.setItem('sound_volume', String(v));
    set({ soundVolume: v });
  },
  setSoundMuted: (v) => {
    localStorage.setItem('sound_muted', String(v));
    set({ soundMuted: v });
  },

  displayInBB: localStorage.getItem('display_in_bb') === 'true',
  setDisplayInBB: (v) => {
    localStorage.setItem('display_in_bb', String(v));
    set({ displayInBB: v });
  },
});
