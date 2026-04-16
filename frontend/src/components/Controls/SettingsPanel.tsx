import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { S } from '../../strings';
import './SettingsPanel.css';

interface Settings {
  avatarSize: number;
  fontSize: number;
  communityCardSize: number;
  playerCardSize: number;
  controlsSize: number;
}

const DEFAULTS: Settings = {
  avatarSize: 100,
  fontSize: 100,
  communityCardSize: 100,
  playerCardSize: 100,
  controlsSize: 100,
};

const STORAGE_KEY = 'poker_ui_settings';

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...parsed };
    }
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

function saveSettings(s: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function applySettings(s: Settings) {
  const root = document.documentElement;
  root.style.setProperty('--scale-avatar', String(s.avatarSize / 100));
  root.style.setProperty('--scale-font', String(s.fontSize / 100));
  root.style.setProperty('--scale-community-card', String(s.communityCardSize / 100));
  root.style.setProperty('--scale-player-card', String(s.playerCardSize / 100));
  root.style.setProperty('--scale-controls', String(s.controlsSize / 100));
}

export function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const displayInBB = useStore((s) => s.displayInBB);
  const setDisplayInBB = useStore((s) => s.setDisplayInBB);
  const hotkeysEnabled = useStore((s) => s.hotkeysEnabled);
  const setHotkeysEnabled = useStore((s) => s.setHotkeysEnabled);
  const vibrateEnabled = useStore((s) => s.vibrateEnabled);
  const setVibrateEnabled = useStore((s) => s.setVibrateEnabled);
  const confirmAllIn = useStore((s) => s.confirmAllIn);
  const setConfirmAllIn = useStore((s) => s.setConfirmAllIn);
  const opponentSoundVolume = useStore((s) => s.opponentSoundVolume);
  const setOpponentSoundVolume = useStore((s) => s.setOpponentSoundVolume);

  // Apply on mount and whenever settings change
  useEffect(() => {
    applySettings(settings);
    saveSettings(settings);
  }, [settings]);

  const update = useCallback((key: keyof Settings, value: number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => {
    setSettings({ ...DEFAULTS });
  }, []);

  return (
    <div className={`settings-panel ${open ? 'open' : ''}`}>
      <button
        className="settings-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="settings-body"
      >
        {S.settingsTitle}
      </button>
      {open && (
        <div className="settings-body" id="settings-body" role="region" aria-label={S.settingsTitle}>
          <SettingSlider label={S.settingAvatarSize} value={settings.avatarSize} onChange={(v) => update('avatarSize', v)} />
          <SettingSlider label={S.settingFontSize} value={settings.fontSize} onChange={(v) => update('fontSize', v)} />
          <SettingSlider label={S.settingCommunityCardSize} value={settings.communityCardSize} onChange={(v) => update('communityCardSize', v)} />
          <SettingSlider label={S.settingPlayerCardSize} value={settings.playerCardSize} onChange={(v) => update('playerCardSize', v)} />
          <SettingSlider label={S.settingControlsSize} value={settings.controlsSize} onChange={(v) => update('controlsSize', v)} />
          <SettingSlider
            label={S.settingOpponentVolume}
            value={Math.round(opponentSoundVolume * 100)}
            min={0}
            max={100}
            onChange={(v) => setOpponentSoundVolume(v / 100)}
          />
          <SettingToggle label={S.settingDisplayBB} checked={displayInBB} onChange={setDisplayInBB} />
          <SettingToggle label={S.settingHotkeys} checked={hotkeysEnabled} onChange={setHotkeysEnabled} />
          <SettingToggle label={S.settingVibrate} checked={vibrateEnabled} onChange={setVibrateEnabled} />
          <SettingToggle label={S.settingConfirmAllIn} checked={confirmAllIn} onChange={setConfirmAllIn} />
          <button className="settings-reset-btn" onClick={reset}>{S.settingReset}</button>
        </div>
      )}
    </div>
  );
}

function SettingToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="setting-row">
      <label className="setting-label">{label}</label>
      <div className="setting-slider-row">
        <label className="setting-toggle-switch">
          <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
          <span className="setting-toggle-track" />
        </label>
      </div>
    </div>
  );
}

function SettingSlider({
  label,
  value,
  onChange,
  min = 50,
  max = 200,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="setting-row">
      <label className="setting-label">{label}</label>
      <div className="setting-slider-row">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="setting-slider"
          aria-label={label}
        />
        <span className="setting-value">{value}%</span>
      </div>
    </div>
  );
}
