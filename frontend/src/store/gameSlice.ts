import { StateCreator } from 'zustand';
import { GameState, FrolTipRequest, TableConfig, ShtosState } from '../types';

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

  // Queue of admin approval requests (rebuy + join). Rendered sequentially
  // so concurrent requests from multiple players no longer overwrite each other.
  pendingApprovals: Array<{
    kind: 'rebuy' | 'join';
    request_id: string;
    player_id: string;
    amount: number;
    nickname?: string;
  }>;
  addApproval: (req: GameSlice['pendingApprovals'][number]) => void;
  removeApproval: (request_id: string) => void;
  removeApprovalByPlayer: (player_id: string, kind?: 'rebuy' | 'join') => void;

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

  // Winner highlight
  winnerPlayerIds: string[];
  setWinnerPlayerIds: (ids: string[]) => void;

  // === Shtos (head-to-head card gambling) ===
  shtos: ShtosState | null;
  setShtos: (s: ShtosState | null) => void;
  shtosBlocks: string[];                     // player_ids I have blocked
  setShtosBlocks: (ids: string[]) => void;
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

  pendingApprovals: [],
  addApproval: (req) =>
    set((state) => {
      // Avoid duplicates (e.g. reconnect re-broadcasts) by request_id
      if (state.pendingApprovals.some((a) => a.request_id === req.request_id)) {
        return state;
      }
      return { pendingApprovals: [...state.pendingApprovals, req] };
    }),
  removeApproval: (request_id) =>
    set((state) => ({
      pendingApprovals: state.pendingApprovals.filter((a) => a.request_id !== request_id),
    })),
  removeApprovalByPlayer: (player_id, kind) =>
    set((state) => ({
      pendingApprovals: state.pendingApprovals.filter(
        (a) => !(a.player_id === player_id && (!kind || a.kind === kind))
      ),
    })),

  danilkaEvent: false,
  setDanilkaEvent: (v) => set({ danilkaEvent: v }),

  turnTimer: null,
  setTurnTimer: (t) => set({ turnTimer: t }),

  rebuyWindow: null,
  setRebuyWindow: (w) => set({ rebuyWindow: w }),

  cashoutPending: false,
  setCashoutPending: (v) => set({ cashoutPending: v }),

  winnerPlayerIds: [],
  setWinnerPlayerIds: (ids) => set({ winnerPlayerIds: ids }),

  shtos: null,
  setShtos: (s) => set({ shtos: s }),
  shtosBlocks: [],
  setShtosBlocks: (ids) => set({ shtosBlocks: ids }),
});
