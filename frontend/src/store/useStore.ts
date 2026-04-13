import { create } from 'zustand';
import { GameState, PlayerInfo, FrolTipRequest, TableConfig } from '../types';

function getOrCreateSessionId(): string {
  let id = localStorage.getItem('session_id');
  if (!id) {
    // some browsers only expose crypto.randomUUID in secure contexts (https/localhost)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      id = crypto.randomUUID();
    } else {
      // Fallback: build a UUID v4 from crypto.getRandomValues
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    localStorage.setItem('session_id', id);
  }
  return id;
}

function getSavedNickname(): string {
  return localStorage.getItem('nickname') || '';
}

function getSavedVolume(): number {
  const v = localStorage.getItem('sound_volume');
  return v !== null ? parseFloat(v) : 0.7;
}

function getSavedMuted(): boolean {
  return localStorage.getItem('sound_muted') === 'true';
}

interface AppState {
  // Session
  sessionId: string;
  nickname: string;
  avatarUrl: string | null;
  setNickname: (name: string) => void;
  setAvatarUrl: (url: string) => void;

  // Table
  tableId: string | null;
  tableConfig: TableConfig | null;
  setTableId: (id: string | null) => void;
  setTableConfig: (config: TableConfig | null) => void;

  // Game
  gameState: GameState | null;
  setGameState: (state: GameState | null) => void;

  // My player info
  myPlayerId: string | null;
  setMyPlayerId: (id: string | null) => void;

  // Frol tip
  frolTipRequest: FrolTipRequest | null;
  setFrolTipRequest: (req: FrolTipRequest | null) => void;

  // Rebuy request (admin sees)
  pendingRebuy: { player_id: string; amount: number; request_id: string } | null;
  setPendingRebuy: (req: any | null) => void;

  // Danilka event animation
  danilkaEvent: boolean;
  setDanilkaEvent: (v: boolean) => void;

  // Turn timer
  turnTimer: {
    playerId: string;
    timeLimit: number;
    timeBank: number;
    usingTimeBank: boolean;
    startedAt: number;
  } | null;
  setTurnTimer: (t: AppState['turnTimer']) => void;

  // Rebuy window
  rebuyWindow: {
    bustPlayerIds: string[];
    timeout: number;
    startedAt: number;
  } | null;
  setRebuyWindow: (w: AppState['rebuyWindow']) => void;

  // Cashout pending
  cashoutPending: boolean;
  setCashoutPending: (v: boolean) => void;

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

  // AFK — player left the table view but is still at the table
  afkTableId: string | null;
  afkTableStack: number | null;
  setAfkTable: (tableId: string, stack: number) => void;
  clearAfkTable: () => void;

  // UI
  soundVolume: number;
  soundMuted: boolean;
  setSoundVolume: (v: number) => void;
  setSoundMuted: (v: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  sessionId: getOrCreateSessionId(),
  nickname: getSavedNickname(),
  avatarUrl: null,
  setNickname: (name) => {
    localStorage.setItem('nickname', name);
    set({ nickname: name });
  },
  setAvatarUrl: (url) => set({ avatarUrl: url }),

  tableId: null,
  tableConfig: null,
  setTableId: (id) => set({ tableId: id }),
  setTableConfig: (config) => set({ tableConfig: config }),

  gameState: null,
  setGameState: (state) => set({ gameState: state }),

  myPlayerId: null,
  setMyPlayerId: (id) => set({ myPlayerId: id }),

  frolTipRequest: null,
  setFrolTipRequest: (req) => set({ frolTipRequest: req }),

  pendingRebuy: null,
  setPendingRebuy: (req) => set({ pendingRebuy: req }),

  danilkaEvent: false,
  setDanilkaEvent: (v) => set({ danilkaEvent: v }),

  turnTimer: null,
  setTurnTimer: (t) => set({ turnTimer: t }),

  rebuyWindow: null,
  setRebuyWindow: (w) => set({ rebuyWindow: w }),

  cashoutPending: false,
  setCashoutPending: (v) => set({ cashoutPending: v }),

  stallingAccused: false,
  setStallingAccused: (v) => set({ stallingAccused: v }),

  kickedCashout: null,
  setKicked: (cashout) => set({ kickedCashout: cashout }),
  clearKicked: () => set({ kickedCashout: null }),

  showKickedOverlay: false,
  setShowKickedOverlay: (v) => set({ showKickedOverlay: v }),

  afkTableId: null,
  afkTableStack: null,
  setAfkTable: (tableId, stack) => set({ afkTableId: tableId, afkTableStack: stack }),
  clearAfkTable: () => set({ afkTableId: null, afkTableStack: null }),

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
}));
