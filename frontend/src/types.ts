export interface TableSummary {
  id: string;
  name: string;
  type: 'cash' | 'tournament';
  players_count: number;
  max_players: number;
  blind_small: number;
  status: string;
}

export interface PlayerInfo {
  player_id: string;
  session_id: string;
  nickname: string;
  avatar_url: string | null;
  seat_index: number;
  stack: number;
  bet: number;
  status: 'active' | 'folded' | 'allin' | 'bust' | 'away' | 'sitting_out';
  away: boolean;
  pending_away: boolean;
  hole_cards: string[] | null;
  revealed_cards: string[];
  hand_name: string | null;
}

export interface CashoutLedgerEntry {
  nickname: string;
  total_buyin: number;
  total_cashout: number;
  current_stack: number;
}

export interface GameLogEntry {
  time: string;
  round: number;
  message: string;
}

export interface GameState {
  table_id: string;
  round_number: number;
  stage: string;
  pot: number;
  community_cards: string[];
  current_bet: number;
  min_raise: number;
  dealer_seat: number;
  blind_small: number;
  blind_big: number;
  current_player_seat: number | null;
  players: PlayerInfo[];
  cashout_ledger?: CashoutLedgerEntry[];
  frol_total_tips?: number;
  game_log?: GameLogEntry[];
}

export interface TableConfig {
  id: string;
  invite_code: string;
  name: string;
  admin_session_id: string;
  type: 'cash' | 'tournament';
  dealer_type: 'robot' | 'frol' | 'danilka';
  blind_small: number;
  blind_big: number;
  time_per_move: number;
  time_bank_max: number;
  min_buyin: number | null;
  max_buyin: number | null;
  starting_stack: number | null;
  tournament_blind_interval: number | null;
  tournament_blind_multiplier: number | null;
  status: string;
}

export interface FrolTipRequest {
  pot: number;
  winner_id: string;
  decline_button_type: 'flying' | 'invisible' | 'trick';
  tip_timeout: number;
  min_tip_percent: number;
  max_tip_percent: number;
  tip_step: number;
}

export interface WsEvent {
  event: string;
  [key: string]: any;
}

export type CardSuit = 'h' | 'd' | 'c' | 's';
export type CardRank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  rank: CardRank;
  suit: CardSuit;
  str: string;
}
