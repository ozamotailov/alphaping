export interface Me {
  tg_id?: number;
  tier: string; // free | pro | whale
  pro_expires_at?: number | null;
  ton_address?: string | null;
}

export interface WatchItem {
  id: number;
  address_friendly: string;
  label?: string | null;
  is_smartmoney: boolean;
}

export interface ApiError extends Error {
  status?: number;
  body?: { error?: string; upsell?: string };
}
