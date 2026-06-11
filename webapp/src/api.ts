import { tg } from "./telegram";
import type { Me, WatchItem, ApiError, Portfolio } from "./types";

// Пусто => запросы идут на тот же origin (относительные /api/...),
// что работает и когда фронт раздаётся бэкендом, и через dev-прокси Vite.
const API = import.meta.env.VITE_API_URL || "";

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    // Бэкенд валидирует эту строку в src/api/auth.ts
    "X-Telegram-Init-Data": tg?.initData ?? "",
  };
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || res.statusText) as ApiError;
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res.json() as Promise<T>;
}

export const api = {
  me: () => req<Me>("/api/me"),
  portfolio: () => req<Portfolio>("/api/portfolio"),
  watchlist: () => req<WatchItem[]>("/api/watchlist"),
  addWatch: (address: string) =>
    req<{ ok: true; walletId: number }>("/api/watch", {
      method: "POST",
      body: JSON.stringify({ address }),
    }),
  removeWatch: (walletId: number) =>
    req<{ ok: true }>(`/api/watch/${walletId}`, { method: "DELETE" }),
  invoice: (plan: string) =>
    req<{ link: string }>("/api/invoice", {
      method: "POST",
      body: JSON.stringify({ plan }),
    }),
  setTonAddress: (address: string) =>
    req<{ ok: true; address: string }>("/api/ton-address", {
      method: "POST",
      body: JSON.stringify({ address }),
    }),
  jettonMeta: (address: string) =>
    req<{ symbol: string; decimals: number; image?: string; verified: boolean }>(
      `/api/jetton/${address}`,
    ),
  smartMoney: () =>
    req<{
      locked: boolean;
      count?: number;
      following?: boolean;
      members?: { address_friendly: string; score: number }[];
    }>("/api/smart-money"),
  followSmartMoney: (on: boolean) =>
    req<{ ok: true; following: boolean }>("/api/smart-money/follow", {
      method: "POST",
      body: JSON.stringify({ on }),
    }),
};
