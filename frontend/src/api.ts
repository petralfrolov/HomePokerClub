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
  listTables: () => request<any[]>('/tables'),

  createTable: (data: any) =>
    request<{ table_id: string; invite_code: string }>('/tables', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getTable: (id: string) => request<any>(`/tables/${id}`),

  deleteTable: (id: string) =>
    request<any>(`/tables/${id}`, { method: 'DELETE' }),

  joinTable: (tableId: string, data: { session_id: string; nickname: string; buyin: number }) =>
    request<{ player_id: string; seat_index: number }>(`/tables/${tableId}/join`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  leaveTable: (tableId: string, session_id: string) =>
    request<any>(`/tables/${tableId}/leave`, {
      method: 'POST',
      body: JSON.stringify({ session_id }),
    }),

  cashout: (tableId: string, session_id: string) =>
    request<any>(`/tables/${tableId}/cashout`, {
      method: 'POST',
      body: JSON.stringify({ session_id }),
    }),

  // Game
  startGame: (tableId: string, session_id: string) =>
    request<any>(`/tables/${tableId}/start`, {
      method: 'POST',
      body: JSON.stringify({ session_id }),
    }),

  gameAction: (tableId: string, data: { session_id: string; action: string; amount?: number }) =>
    request<any>(`/tables/${tableId}/action`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Social
  tipPlayer: (tableId: string, data: { session_id: string; target_player_id: string; amount: number }) =>
    request<any>(`/tables/${tableId}/tip`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  accuseStalling: (tableId: string, data: { session_id: string; target_player_id: string }) =>
    request<any>(`/tables/${tableId}/accuse-stalling`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  revealCard: (tableId: string, data: { session_id: string; card_index: number }) =>
    request<any>(`/tables/${tableId}/reveal-card`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  setAway: (tableId: string, data: { session_id: string; away: boolean }) =>
    request<any>(`/tables/${tableId}/away`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Rebuy
  requestRebuy: (tableId: string, data: { session_id: string; amount: number }) =>
    request<any>(`/tables/${tableId}/rebuy/request`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  approveRebuy: (tableId: string, data: { session_id: string; target_player_id: string; amount: number }) =>
    request<any>(`/tables/${tableId}/rebuy/approve`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  denyRebuy: (tableId: string, data: { session_id: string; target_player_id: string }) =>
    request<any>(`/tables/${tableId}/rebuy/deny`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Frol
  frolTip: (tableId: string, data: { session_id: string; amount: number }) =>
    request<any>(`/tables/${tableId}/frol-tip`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  frolDecline: (tableId: string, session_id: string) =>
    request<any>(`/tables/${tableId}/frol-tip/decline`, {
      method: 'POST',
      body: JSON.stringify({ session_id }),
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

  getProfile: (session_id: string) => request<any>(`/players/${session_id}`),
};
