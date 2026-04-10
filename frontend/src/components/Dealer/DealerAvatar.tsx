import './Dealer.css';

interface Props {
  dealerType: 'robot' | 'frol' | 'danilka';
}

const DEALER_NAMES: Record<string, string> = {
  robot: 'Робот',
  frol: 'Фрол',
  danilka: 'Данилка',
};

export function DealerAvatar({ dealerType }: Props) {
  return (
    <div className="dealer-avatar">
      <img
        src={`/static/dealer_avatars/${dealerType}.png`}
        alt={DEALER_NAMES[dealerType]}
        className="dealer-img"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
      <span className="dealer-name">{DEALER_NAMES[dealerType]}</span>
    </div>
  );
}
