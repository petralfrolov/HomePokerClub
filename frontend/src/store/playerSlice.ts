import { StateCreator } from 'zustand';

function getOrCreateSessionId(): string {
  let id = localStorage.getItem('session_id');
  if (!id) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      id = crypto.randomUUID();
    } else {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
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

export interface PlayerSlice {
  // Session
  sessionId: string;
  nickname: string;
  avatarUrl: string | null;
  setNickname: (name: string) => void;
  setAvatarUrl: (url: string) => void;

  // My player info
  myPlayerId: string | null;
  setMyPlayerId: (id: string | null) => void;

  // AFK
  afkTableId: string | null;
  afkTableStack: number | null;
  setAfkTable: (tableId: string, stack: number) => void;
  clearAfkTable: () => void;
}

export const createPlayerSlice: StateCreator<PlayerSlice, [], [], PlayerSlice> = (set) => ({
  sessionId: getOrCreateSessionId(),
  nickname: getSavedNickname(),
  avatarUrl: null,
  setNickname: (name) => {
    localStorage.setItem('nickname', name);
    set({ nickname: name });
  },
  setAvatarUrl: (url) => set({ avatarUrl: url }),

  myPlayerId: null,
  setMyPlayerId: (id) => set({ myPlayerId: id }),

  afkTableId: null,
  afkTableStack: null,
  setAfkTable: (tableId, stack) => set({ afkTableId: tableId, afkTableStack: stack }),
  clearAfkTable: () => set({ afkTableId: null, afkTableStack: null }),
});
