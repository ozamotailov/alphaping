import type { Repo } from "../db/repo";
import { getAccountEvents } from "./tonapiClient";
import { logger } from "../lib/logger";

export interface WalletScore {
  address: string;
  realizedUsd: number;
  winRate: number;
  trades: number;
  score: number;
}

interface NormSwap {
  jetton: string;
  side: "buy" | "sell";
  usd: number;
  qty: number;
  ts: number;
}

/**
 * Извлекает нормализованные свопы из событий tonapi.
 * ВНИМАНИЕ: точная форма action.JettonSwap зависит от схемы tonapi — сверьте поля
 * (jetton_master_in/out, amount_in/out, ton_usd) с openapi.yml перед боем.
 */
function extractSwaps(events: { timestamp: number; actions?: any[] }[]): NormSwap[] {
  const out: NormSwap[] = [];
  for (const ev of events) {
    for (const a of ev.actions ?? []) {
      if (a.type !== "JettonSwap" || !a.JettonSwap) continue;
      const s = a.JettonSwap;
      const usd = Number(s.ton_usd ?? s.usd ?? 0);
      const jettonOut = s.jetton_master_out?.address ?? s.jetton_out?.address;
      const jettonIn = s.jetton_master_in?.address ?? s.jetton_in?.address;
      if (jettonOut) {
        // получил jetton за TON/USDT → покупка
        out.push({ jetton: jettonOut, side: "buy", usd, qty: Number(s.amount_out ?? 0), ts: ev.timestamp });
      } else if (jettonIn) {
        out.push({ jetton: jettonIn, side: "sell", usd, qty: Number(s.amount_in ?? 0), ts: ev.timestamp });
      }
    }
  }
  return out.sort((a, b) => a.ts - b.ts);
}

// Реализованный PnL по среднему методу (avg cost) + win-rate по закрытым продажам.
function computePnl(swaps: NormSwap[]) {
  const pos = new Map<string, { qty: number; cost: number }>();
  let realized = 0;
  let wins = 0;
  let closed = 0;

  for (const s of swaps) {
    const p = pos.get(s.jetton) ?? { qty: 0, cost: 0 };
    if (s.side === "buy") {
      p.qty += s.qty;
      p.cost += s.usd;
    } else {
      const avg = p.qty > 0 ? p.cost / p.qty : 0;
      const qtySold = Math.min(s.qty, p.qty);
      const costOut = avg * qtySold;
      const pnl = s.usd - costOut;
      realized += pnl;
      closed++;
      if (pnl > 0) wins++;
      p.qty = Math.max(0, p.qty - s.qty);
      p.cost = Math.max(0, p.cost - costOut);
    }
    pos.set(s.jetton, p);
  }
  return { realized, wins, closed };
}

/** Скоринг одного кошелька по торговой истории за окно. */
export async function scoreWallet(raw: string, days = 30): Promise<WalletScore> {
  const startDate = Math.floor(Date.now() / 1000) - days * 86400;
  const events = await getAccountEvents(raw, { limit: 100, startDate });
  const swaps = extractSwaps(events);
  const { realized, wins, closed } = computePnl(swaps);
  const winRate = closed > 0 ? wins / closed : 0;
  const trades = swaps.length;
  // Требуем минимум активности, иначе шум. Скор = реализованный PnL × win-rate.
  const score = trades >= 5 && closed >= 2 ? realized * winRate : 0;
  return { address: raw, realizedUsd: realized, winRate, trades, score };
}

/**
 * Перестраивает кураторский список: скорит кандидатов, оставляет топ-N с положительным скором,
 * пишет в smart_lists/smart_list_members и помечает wallets.is_smartmoney.
 *
 * Источник кандидатов (активные свопперы пулов STON.fi и т.п.) — отдельная задача;
 * сюда передаётся уже собранный список raw-адресов.
 */
export async function rebuildSmartList(
  repo: Repo,
  listName: string,
  candidates: string[],
  topN = 50,
): Promise<WalletScore[]> {
  const results = await Promise.all(candidates.map((c) => scoreWallet(c).catch(() => null)));
  const scored = results.filter((x): x is WalletScore => x != null && x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, topN);
  await repo.replaceSmartList(
    listName,
    top.map((t) => ({ address: t.address, score: t.score })),
  );
  logger.info(`smart-money '${listName}': скоринг ${candidates.length}, оставлено ${top.length}`);
  return top;
}
