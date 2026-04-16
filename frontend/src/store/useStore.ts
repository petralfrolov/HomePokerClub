import { create } from 'zustand';
import { PlayerSlice, createPlayerSlice } from './playerSlice';
import { GameSlice, createGameSlice } from './gameSlice';
import { UiSlice, createUiSlice } from './uiSlice';
import { ToastSlice, createToastSlice, ToastKind } from './toastSlice';

export type AppState = PlayerSlice & GameSlice & UiSlice & ToastSlice;

export const useStore = create<AppState>()((...a) => ({
  ...createPlayerSlice(...a),
  ...createGameSlice(...a),
  ...createUiSlice(...a),
  ...createToastSlice(...a),
}));

/**
 * Imperative toast helper for use outside React components
 * (hooks, plain modules, error handlers).
 */
export function toast(message: string, kind: ToastKind = 'info', duration?: number): number {
  return useStore.getState().showToast(message, kind, duration);
}
