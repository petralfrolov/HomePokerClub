import type { TableSummary, TableConfig, GameState } from './types';

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
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

  // Avatar
  uploadAvatar: async (session_id: string, file: File) => {
    const form = new FormData();
    form.append('session_id', session_id);
    form.append('file', file);
    const res = await fetch(`${API_BASE}/players/avatar`, { method: 'POST', body: form });
    if (!res.ok) throw new Error('Upload failed');
    return res.json() as Promise<{ avatar_url: string }>;
  },

  getProfile: (session_id: string) => request<{ session_id: string; nickname: string; avatar_url: string | null }>(`/players/${session_id}`),
};
