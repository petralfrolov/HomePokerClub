import { S } from '../../strings';
import './Dealer.css';

interface Props {
  dealerType: 'robot' | 'frol' | 'danilka';
}

export function DealerAvatar({ dealerType }: Props) {
  return (
    <div className="dealer-avatar">
      <img
        src={`/static/dealer_avatars/${dealerType}.png`}
        alt={S.dealerNames[dealerType]}
        className="dealer-img"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
      <span className="dealer-name">{S.dealerNames[dealerType]}</span>
    </div>
  );
}
