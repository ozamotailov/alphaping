export interface Me {
  tg_id?: number;
  tier: string; // free | pro | whale
  pro_expires_at?: number | null;
  ton_address?: string | null;
  language_code?: string | null;
}

export interface WatchItem {
  id: number;
  address_friendly: string;
  label?: string | null;
  is_smartmoney: boolean;
}

export interface SmartMoney {
  locked: boolean;
  count?: number;
  following?: boolean;
  members?: { address_friendly: string; score: number }[];
}

export interface Holding {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  qty: number;
  usd: number;
  image?: string;
  verified: boolean;
}

export interface Portfolio {
  connected: boolean;
  address?: string;
  totalUsd?: number;
  ton?: { qty: number; usd: number };
  holdings?: Holding[];
  realizedPnl30d?: number;
  trades?: number;
  winRate?: number;
}

export interface ApiError extends Error {
  status?: number;
  body?: { error?: string; upsell?: string };
}
