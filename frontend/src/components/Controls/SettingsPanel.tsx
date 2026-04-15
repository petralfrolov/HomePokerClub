import { useState, useEffect, useCallback } from 'react';
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
      <button className="settings-toggle" onClick={() => setOpen(!open)}>
        {S.settingsTitle}
      </button>
      {open && (
        <div className="settings-body">
          <SettingSlider label={S.settingAvatarSize} value={settings.avatarSize} onChange={(v) => update('avatarSize', v)} />
          <SettingSlider label={S.settingFontSize} value={settings.fontSize} onChange={(v) => update('fontSize', v)} />
          <SettingSlider label={S.settingCommunityCardSize} value={settings.communityCardSize} onChange={(v) => update('communityCardSize', v)} />
          <SettingSlider label={S.settingPlayerCardSize} value={settings.playerCardSize} onChange={(v) => update('playerCardSize', v)} />
          <SettingSlider label={S.settingControlsSize} value={settings.controlsSize} onChange={(v) => update('controlsSize', v)} />
          <button className="settings-reset-btn" onClick={reset}>{S.settingReset}</button>
        </div>
      )}
    </div>
  );
}

function SettingSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="setting-row">
      <label className="setting-label">{label}</label>
      <div className="setting-slider-row">
        <input
          type="range"
          min={50}
          max={200}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="setting-slider"
        />
        <span className="setting-value">{value}%</span>
      </div>
    </div>
  );
}
