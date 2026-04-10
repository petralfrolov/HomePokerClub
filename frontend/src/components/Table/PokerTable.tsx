import { ReactNode } from 'react';
import './Table.css';

interface Props {
  children: ReactNode;
}

export function PokerTable({ children }: Props) {
  return (
    <div className="poker-table-wrapper">
      <div className="poker-table">
        <div className="poker-table-felt">
          {children}
        </div>
      </div>
    </div>
  );
}
