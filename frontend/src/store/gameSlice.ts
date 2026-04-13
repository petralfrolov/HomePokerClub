import { StateCreator } from 'zustand';
import { GameState, FrolTipRequest, TableConfig } from '../types';

export interface GameSlice {
  // Table
  tableId: string | null;
  tableConfig: TableConfig | null;
  setTableId: (id: string | null) => void;
  setTableConfig: (config: TableConfig | null) => void;

  // Game
  gameState: GameState | null;
  setGameState: (state: GameState | null) => void;

  // Frol tip
  frolTipRequest: FrolTipRequest | null;
  setFrolTipRequest: (req: FrolTipRequest | null) => void;

  // Rebuy request (admin sees)
  pendingRebuy: { player_id: string; amount: number; request_id: string } | null;
  setPendingRebuy: (req: GameSlice['pendingRebuy']) => void;

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
  setTurnTimer: (t: GameSlice['turnTimer']) => void;

  // Rebuy window
  rebuyWindow: {
    bustPlayerIds: string[];
    timeout: number;
    startedAt: number;
  } | null;
  setRebuyWindow: (w: GameSlice['rebuyWindow']) => void;

  // Cashout pending
  cashoutPending: boolean;
  setCashoutPending: (v: boolean) => void;
}

export const createGameSlice: StateCreator<GameSlice, [], [], GameSlice> = (set) => ({
  tableId: null,
  tableConfig: null,
  setTableId: (id) => set({ tableId: id }),
  setTableConfig: (config) => set({ tableConfig: config }),

  gameState: null,
  setGameState: (state) => set({ gameState: state }),

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
});
