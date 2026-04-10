import './Table.css';

interface Props {
  card: string; // e.g. "Ah", "Ks", "Td"
  size?: 'small' | 'medium' | 'large';
  faceDown?: boolean;
  onReveal?: () => void;
  showRevealHint?: boolean;
}

const SUIT_SYMBOLS: Record<string, string> = {
  h: '♥',
  d: '♦',
  c: '♣',
  s: '♠',
};

const SUIT_COLORS: Record<string, string> = {
  h: '#e74c3c',
  d: '#3498db',
  c: '#2d6a4f',
  s: '#2c3e50',
};

const RANK_DISPLAY: Record<string, string> = {
  T: '10',
  J: 'J',
  Q: 'Q',
  K: 'K',
  A: 'A',
};

export function CardDisplay({ card, size = 'medium', faceDown, onReveal, showRevealHint }: Props) {
  if (faceDown || !card) {
    return (
      <div className={`card card-back card-${size}`}>
        <div className="card-back-pattern">🂠</div>
      </div>
    );
  }

  const rank = card[0];
  const suit = card[1];
  const displayRank = RANK_DISPLAY[rank] || rank;
  const suitSymbol = SUIT_SYMBOLS[suit] || suit;
  const color = SUIT_COLORS[suit] || '#fff';

  return (
    <div
      className={`card card-face card-${size}`}
      style={{ color }}
      onClick={onReveal}
    >
      <div className="card-rank">{displayRank}</div>
      <div className="card-suit">{suitSymbol}</div>
      {showRevealHint && (
        <div className="card-reveal-hint">👁 Показать</div>
      )}
    </div>
  );
}
