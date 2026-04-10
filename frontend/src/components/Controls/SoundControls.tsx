import { useStore } from '../../store/useStore';
import './Controls.css';

export function SoundControls() {
  const volume = useStore((s) => s.soundVolume);
  const muted = useStore((s) => s.soundMuted);
  const setVolume = useStore((s) => s.setSoundVolume);
  const setMuted = useStore((s) => s.setSoundMuted);

  return (
    <div className="sound-controls">
      <button className="sound-mute-btn" onClick={() => setMuted(!muted)}>
        {muted ? '🔇' : volume > 0.5 ? '🔊' : '🔉'}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={muted ? 0 : volume}
        onChange={(e) => {
          setVolume(parseFloat(e.target.value));
          if (parseFloat(e.target.value) > 0) setMuted(false);
        }}
        className="sound-slider"
      />
    </div>
  );
}
