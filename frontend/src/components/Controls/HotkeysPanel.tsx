import { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import type { HotkeyAction } from '../../store/uiSlice';
import { S } from '../../strings';
import './HotkeysPanel.css';

const ACTION_ORDER: { key: HotkeyAction; label: string }[] = [
  { key: 'fold', label: S.hotkeyFold },
  { key: 'checkCall', label: S.hotkeyCheckCall },
  { key: 'raiseMin', label: S.hotkeyRaiseMin },
  { key: 'raiseConfirm', label: S.hotkeyRaiseConfirm },
  { key: 'allIn', label: S.hotkeyAllIn },
  { key: 'stepDown', label: S.hotkeyStepDown },
  { key: 'stepUp', label: S.hotkeyStepUp },
  { key: 'away', label: S.hotkeyAway },
];

function displayKey(k: string): string {
  if (!k) return '—';
  if (k === ' ') return 'Space';
  if (k.length === 1) return k.toUpperCase();
  return k;
}

export function HotkeysPanel() {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 768px)');
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const bindings = useStore((s) => s.hotkeyBindings);
  const setHotkeyBinding = useStore((s) => s.setHotkeyBinding);
  const resetHotkeyBindings = useStore((s) => s.resetHotkeyBindings);
  const presets = useStore((s) => s.raisePresetsBB);
  const setRaisePresetBB = useStore((s) => s.setRaisePresetBB);
  const resetRaisePresetsBB = useStore((s) => s.resetRaisePresetsBB);

  const [listening, setListening] = useState<HotkeyAction | null>(null);

  // Capture next key when listening is set
  useEffect(() => {
    if (!listening) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setListening(null);
        return;
      }
      setHotkeyBinding(listening, e.key);
      setListening(null);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [listening, setHotkeyBinding]);

  if (isMobile) return null;

  return (
    <div className={`hotkeys-panel ${open ? 'open' : ''}`}>
      <button
        className="hotkeys-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="hotkeys-body"
      >
        {S.hotkeysTitle}
      </button>
      {open && (
        <div className="hotkeys-body" id="hotkeys-body" role="region" aria-label={S.hotkeysTitle}>
          <div className="hotkeys-section-header">{S.hotkeysActionsHeader}</div>
          {ACTION_ORDER.map(({ key, label }) => (
            <div className="hotkey-row" key={key}>
              <span className="hotkey-label">{label}</span>
              <button
                className={`hotkey-key-btn ${listening === key ? 'listening' : ''}`}
                onClick={() => setListening(key)}
                title={S.hotkeyRebindHint}
              >
                {listening === key ? S.hotkeyPressKey : displayKey(bindings[key])}
              </button>
            </div>
          ))}

          <div className="hotkeys-section-header">{S.hotkeysPresetsHeader}</div>
          {([0, 1, 2, 3] as const).map((i) => {
            const presetKeyAction = `preset${i + 1}` as HotkeyAction;
            return (
              <div className="hotkey-row" key={`preset-${i}`}>
                <span className="hotkey-label">{S.hotkeyPreset(i + 1)}</span>
                <div className="hotkey-preset-row">
                  <input
                    type="number"
                    className="hotkey-preset-input"
                    min={0.5}
                    step={0.5}
                    value={presets[i]}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isFinite(v) && v > 0) setRaisePresetBB(i, v);
                    }}
                  />
                  <span className="hotkey-preset-unit">ББ</span>
                  <button
                    className={`hotkey-key-btn ${listening === presetKeyAction ? 'listening' : ''}`}
                    onClick={() => setListening(presetKeyAction)}
                    title={S.hotkeyRebindHint}
                  >
                    {listening === presetKeyAction ? S.hotkeyPressKey : displayKey(bindings[presetKeyAction])}
                  </button>
                </div>
              </div>
            );
          })}

          <div className="hotkeys-actions-row">
            <button className="hotkeys-reset-btn" onClick={resetHotkeyBindings}>{S.hotkeyResetAll}</button>
            <button className="hotkeys-reset-btn" onClick={resetRaisePresetsBB}>{S.hotkeyResetPresets}</button>
          </div>
        </div>
      )}
    </div>
  );
}
