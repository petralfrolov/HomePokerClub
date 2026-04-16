import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';

export interface HotkeyActions {
  onFold: () => void;
  onCheckOrCall: () => void;
  onRaiseMin: () => void;
  onRaiseConfirm: () => void;
  onAllIn: () => void;
  onStepUp: () => void;
  onStepDown: () => void;
  onAway: () => void;
  onPreset: (index: 0 | 1 | 2 | 3) => void;
}

function normalizeKey(k: string): string {
  if (!k) return '';
  if (k.length === 1) return k.toLowerCase();
  return k;
}

/**
 * Keyboard shortcuts for poker actions. Only active while mounted.
 * Respects `hotkeysEnabled` setting and ignores input/textarea focus.
 * Bindings are configurable via the store (see `HotkeysPanel`).
 */
export function useHotkeys(actions: HotkeyActions, enabled: boolean) {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const hotkeysEnabled = useStore((s) => s.hotkeysEnabled);
  const bindings = useStore((s) => s.hotkeyBindings);

  useEffect(() => {
    if (!enabled || !hotkeysEnabled) return;
    const keyMap: Record<string, string> = {};
    keyMap[normalizeKey(bindings.fold)] = 'fold';
    keyMap[normalizeKey(bindings.checkCall)] = 'checkCall';
    keyMap[normalizeKey(bindings.raiseMin)] = 'raiseMin';
    keyMap[normalizeKey(bindings.raiseConfirm)] = 'raiseConfirm';
    keyMap[normalizeKey(bindings.allIn)] = 'allIn';
    keyMap[normalizeKey(bindings.stepUp)] = 'stepUp';
    keyMap[normalizeKey(bindings.stepDown)] = 'stepDown';
    keyMap[normalizeKey(bindings.away)] = 'away';
    keyMap[normalizeKey(bindings.preset1)] = 'preset1';
    keyMap[normalizeKey(bindings.preset2)] = 'preset2';
    keyMap[normalizeKey(bindings.preset3)] = 'preset3';
    keyMap[normalizeKey(bindings.preset4)] = 'preset4';

    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const action = keyMap[normalizeKey(e.key)];
      if (!action) return;
      e.preventDefault();
      const a = actionsRef.current;
      switch (action) {
        case 'fold': a.onFold(); break;
        case 'checkCall': a.onCheckOrCall(); break;
        case 'raiseMin': a.onRaiseMin(); break;
        case 'raiseConfirm': a.onRaiseConfirm(); break;
        case 'allIn': a.onAllIn(); break;
        case 'stepUp': a.onStepUp(); break;
        case 'stepDown': a.onStepDown(); break;
        case 'away': a.onAway(); break;
        case 'preset1': a.onPreset(0); break;
        case 'preset2': a.onPreset(1); break;
        case 'preset3': a.onPreset(2); break;
        case 'preset4': a.onPreset(3); break;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [enabled, hotkeysEnabled, bindings]);
}

