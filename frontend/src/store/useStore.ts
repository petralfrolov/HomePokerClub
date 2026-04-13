import { create } from 'zustand';
import { PlayerSlice, createPlayerSlice } from './playerSlice';
import { GameSlice, createGameSlice } from './gameSlice';
import { UiSlice, createUiSlice } from './uiSlice';

export type AppState = PlayerSlice & GameSlice & UiSlice;

export const useStore = create<AppState>()((...a) => ({
  ...createPlayerSlice(...a),
  ...createGameSlice(...a),
  ...createUiSlice(...a),
}));
