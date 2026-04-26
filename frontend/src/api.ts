import type { TableSummary, TableConfig, GameState } from './types';

const API_BASE = '/api';
const DEFAULT_TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;
  readonly kind: 'http' | 'network' | 'timeout' | 'aborted';
  constructor(message: string, opts: { status?: number; detail?: string; kind?: ApiError['kind'] } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = opts.status ?? 0;
    this.detail = opts.detail ?? message;
    this.kind = opts.kind ?? 'http';
  }
}

interface RequestOpts extends RequestInit {
  timeoutMs?: number;
  /** Retry on network error / 5xx (default true for GET, false for mutations). */
  retry?: boolean;
}

function isSafeMethod(method: string | undefined): boolean {
  const m = (method || 'GET').toUpperCase();
  return m === 'GET' || m === 'HEAD';
}

async function request<T>(url: string, options?: RequestOpts): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const shouldRetry = options?.retry ?? isSafeMethod(options?.method);
  const maxAttempts = shouldRetry ? 2 : 1;

  let lastError: ApiError | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${API_BASE}${url}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        const message = err.detail || err.message || 'Request failed';
        lastError = new ApiError(message, { status: res.status, detail: message, kind: 'http' });
        // Only retry on 5xx
        if (res.status >= 500 && res.status < 600 && attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 600 * attempt));
          continue;
        }
        throw lastError;
      }
      // 204 No Content
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    } catch (e: any) {
      clearTimeout(timer);
      if (e instanceof ApiError) throw e;
      const isAbort = e?.name === 'AbortError';
      const kind: ApiError['kind'] = isAbort ? 'timeout' : 'network';
      const msg = isAbort ? 'Превышено время ожидания' : 'Нет связи с сервером';
      lastError = new ApiError(msg, { kind, detail: msg });
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 600 * attempt));
        continue;
      }
      throw lastError;
    }
  }
  // Unreachable
  throw lastError ?? new ApiError('Request failed');
}

export const api = {
  // Tables
  listTables: () => request<TableSummary[]>('/tables'),

  createTable: (data: {
    name: string;
    type: string;
    blind_small: number;
    blind_big: number;
    time_per_move?: number;
    time_bank?: number;
    dealer_type?: string;
    min_buyin?: number | null;
    max_buyin?: number | null;
    starting_stack?: number | null;
    tournament_blind_interval?: number | null;
  }) =>
    request<{ table_id: string; invite_code: string }>('/tables', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getTable: (id: string) => request<TableConfig & { players: Array<{ id: string; session_id: string; nickname: string; avatar_url: string | null; seat_index: number; stack: number; time_bank: number; status: string; is_admin: boolean }> }>(`/tables/${id}`),

  deleteTable: (id: string) =>
    request<{ ok: boolean }>(`/tables/${id}`, { method: 'DELETE' }),

  joinTable: (tableId: string, data: { session_id: string; nickname: string; buyin: number }) =>
    request<{ player_id: string; seat_index: number }>(`/tables/${tableId}/join`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  leaveTable: (tableId: string, session_id: string) =>
    request<{ ok: boolean }>(`/tables/${tableId}/leave`, {
      method: 'POST',
      body: JSON.stringify({ session_id }),
    }),

  cashout: (tableId: string, session_id: string) =>
    request<{ ok: boolean }>(`/tables/${tableId}/cashout`, {
      method: 'POST',
      body: JSON.stringify({ session_id }),
    }),

  kickPlayer: (tableId: string, data: { session_id: string; target_player_id: string }) =>
    request<{ ok: boolean }>(`/tables/${tableId}/kick`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Game
  startGame: (tableId: string, session_id: string) =>
    request<{ ok: boolean }>(`/tables/${tableId}/start`, {
      method: 'POST',
      body: JSON.stringify({ session_id }),
    }),

  gameAction: (tableId: string, data: { session_id: string; action: string; amount?: number }) =>
    request<{ ok: boolean; raced?: boolean; game_state_snapshot?: GameState }>(`/tables/${tableId}/action`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Social
  tipPlayer: (tableId: string, data: { session_id: string; target_player_id: string; amount: number }) =>
    request<{ ok: boolean }>(`/tables/${tableId}/tip`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  accuseStalling: (tableId: string, data: { session_id: string; target_player_id: string }) =>
    request<{ ok: boolean }>(`/tables/${tableId}/accuse-stalling`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  revealCard: (tableId: string, data: { session_id: string; card_index: number }) =>
    request<{ ok: boolean }>(`/tables/${tableId}/reveal-card`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  setAway: (tableId: string, data: { session_id: string; away: boolean }) =>
    request<{ ok: boolean }>(`/tables/${tableId}/away`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Rebuy
  requestRebuy: (tableId: string, data: { session_id: string; amount: number }) =>
    request<{ ok: boolean; request_id: string }>(`/tables/${tableId}/rebuy/request`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  approveRebuy: (tableId: string, data: { session_id: string; target_player_id: string; amount: number }) =>
    request<{ ok: boolean }>(`/tables/${tableId}/rebuy/approve`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  denyRebuy: (tableId: string, data: { session_id: string; target_player_id: string }) =>
    request<{ ok: boolean }>(`/tables/${tableId}/rebuy/deny`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Join approval (admin)
  approveJoin: (tableId: string, data: { session_id: string; target_player_id: string }) =>
    request<{ ok: boolean }>(`/tables/${tableId}/join/approve`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  denyJoin: (tableId: string, data: { session_id: string; target_player_id: string }) =>
    request<{ ok: boolean }>(`/tables/${tableId}/join/deny`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Frol
  frolTip: (tableId: string, data: { session_id: string; amount: number }) =>
    request<{ ok: boolean }>(`/tables/${tableId}/frol-tip`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  frolDecline: (tableId: string, session_id: string) =>
    request<{ ok: boolean }>(`/tables/${tableId}/frol-tip/decline`, {
      method: 'POST',
      body: JSON.stringify({ session_id }),
    }),

  changeDealer: (tableId: string, data: { session_id: string; dealer_type: string }) =>
    request<{ ok: boolean }>(`/tables/${tableId}/change-dealer`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // === Shtos (head-to-head card gambling) ===
  proposeShtos: (tableId: string, data: { session_id: string; target_player_id: string; amount: number }) =>
    request<{ ok: boolean; offer_id: string }>(`/tables/${tableId}/shtos/propose`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  acceptShtos: (tableId: string, data: { session_id: string; offer_id: string }) =>
    request<{ ok: boolean }>(`/tables/${tableId}/shtos/accept`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  declineShtos: (tableId: string, data: { session_id: string; offer_id: string }) =>
    request<{ ok: boolean }>(`/tables/${tableId}/shtos/decline`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  cancelShtos: (tableId: string, data: { session_id: string; offer_id: string }) =>
    request<{ ok: boolean }>(`/tables/${tableId}/shtos/cancel`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  pickShtosCard: (tableId: string, data: { session_id: string; offer_id: string; card: string }) =>
    request<{ ok: boolean }>(`/tables/${tableId}/shtos/pick-card`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  setShtosBlock: (tableId: string, data: { session_id: string; target_player_id: string; blocked: boolean }) =>
    request<{ ok: boolean }>(`/tables/${tableId}/shtos/block`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Avatar
  uploadAvatar: async (session_id: string, file: File) => {
    const form = new FormData();
    form.append('session_id', session_id);
    form.append('file', file);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch(`${API_BASE}/players/avatar`, {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new ApiError(err.detail || 'Upload failed', { status: res.status, detail: err.detail || res.statusText });
      }
      return (await res.json()) as { avatar_url: string };
    } catch (e: any) {
      if (e instanceof ApiError) throw e;
      const isAbort = e?.name === 'AbortError';
      throw new ApiError(isAbort ? 'Превышено время ожидания загрузки' : 'Не удалось загрузить аватар', {
        kind: isAbort ? 'timeout' : 'network',
      });
    } finally {
      clearTimeout(timer);
    }
  },

  getProfile: (session_id: string) => request<{ session_id: string; nickname: string; avatar_url: string | null }>(`/players/${session_id}`),
};
