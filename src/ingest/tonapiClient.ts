import { config } from "../config";

// Низкоуровневый клиент tonapi: общий BASE/auth + REST-хелперы + SSE-стрим.
// Используется поллером (tonapi.ts), стримом (tonapiStream.ts), safety и smart-money.

export const BASE = "https://tonapi.io/v2";

export function authHeaders(): Record<string, string> {
  return config.TONAPI_KEY ? { Authorization: `Bearer ${config.TONAPI_KEY}` } : {};
}

export async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { headers: authHeaders() });
  if (!r.ok) throw new Error(`tonapi ${r.status} ${path}`);
  return (await r.json()) as T;
}

// --- Типы событий (минимальные; полная схема — openapi.yml репо tonkeeper/opentonapi) ---
export interface TonApiAction {
  type: string; // "JettonSwap" | "JettonTransfer" | "TonTransfer" | "NftItemTransfer" | ...
  JettonSwap?: any;
  JettonTransfer?: any;
  TonTransfer?: any;
}
export interface TonApiEvent {
  event_id: string;
  lt: number; // logical time — монотонно растёт, используем для дедупа
  timestamp: number; // unix seconds
  actions: TonApiAction[];
}

// Цена TON в USD с кэшем (5 мин) — нужна для USD-оценки свопов (в JettonSwap нет готового usd).
let tonUsdCache: { price: number; at: number } | null = null;
export async function getTonUsd(): Promise<number> {
  const now = Date.now();
  if (tonUsdCache && now - tonUsdCache.at < 5 * 60_000) return tonUsdCache.price;
  try {
    const d = await getJson<{ rates?: { TON?: { prices?: { USD?: number } } } }>(
      "/rates?tokens=ton&currencies=usd",
    );
    const price = d.rates?.TON?.prices?.USD ?? 0;
    if (price > 0) tonUsdCache = { price, at: now };
    return price || tonUsdCache?.price || 0;
  } catch {
    return tonUsdCache?.price ?? 0;
  }
}

export async function getAccountEvents(
  raw: string,
  params: { limit?: number; startDate?: number } = {},
): Promise<TonApiEvent[]> {
  const q = new URLSearchParams();
  q.set("limit", String(params.limit ?? 20));
  if (params.startDate) q.set("start_date", String(params.startDate));
  const { events } = await getJson<{ events: TonApiEvent[] }>(`/accounts/${raw}/events?${q}`);
  return events;
}

/**
 * SSE-стрим транзакций по списку аккаунтов.
 * GET /v2/sse/accounts/transactions?accounts=<csv>
 * Колбэк onAccount вызывается с account_id при каждой новой транзакции (heartbeat'ы пропускаются).
 * Завершается при обрыве потока или abort'е сигнала (тогда возвращает/бросает — управляет вызывающий).
 */
export async function streamAccountTransactions(
  accounts: string[],
  onAccount: (accountId: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const url = `${BASE}/sse/accounts/transactions?accounts=${accounts.join(",")}`;
  const res = await fetch(url, { headers: authHeaders(), signal });
  if (!res.ok || !res.body) throw new Error(`tonapi sse ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buf += decoder.decode(value, { stream: true });

    let sep: number;
    // SSE-кадры разделяются пустой строкой "\n\n"
    while ((sep = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, sep);
      buf = buf.slice(sep + 2);

      let event = "message";
      let data = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (event === "heartbeat" || !data) continue;
      try {
        const obj = JSON.parse(data) as { account_id?: string };
        if (obj.account_id) onAccount(String(obj.account_id));
      } catch {
        /* игнорируем некорректные кадры */
      }
    }
  }
}
