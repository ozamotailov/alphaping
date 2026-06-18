import { alertQueue } from "../alerts/queue";
import type { Repo } from "../db/repo";
import { config } from "../config";
import { logger } from "../lib/logger";
import { getAccountEvents, type TonApiAction, type TonApiEvent } from "./tonapiClient";

// Защита от гонки: один и тот же адрес может прийти одновременно из SSE и из бэкфилл-поллера.
const inflight = new Set<string>();

/**
 * Идемпотентно обрабатывает один адрес: тянет события свежее курсора lt, диспатчит их
 * в очередь алертов и двигает курсор. Вызывается и SSE-стримом (мгновенно), и поллером (бэкфилл).
 */
export async function processAccount(repo: Repo, raw: string): Promise<void> {
  if (inflight.has(raw)) return;
  inflight.add(raw);
  try {
    const lastLt = await repo.getLastLt(raw);
    const events = await getAccountEvents(raw, { limit: 20 });

    let maxLt = lastLt;
    // события приходят от новых к старым — идём в обратном порядке для хронологии
    for (const ev of [...events].reverse()) {
      if (ev.lt <= lastLt) continue;
      maxLt = Math.max(maxLt, ev.lt);
      for (const a of ev.actions) await dispatch(raw, ev, a);
    }
    if (maxLt > lastLt) await repo.setLastLt(raw, maxLt);
  } catch (e) {
    logger.warn("processAccount failed", { raw, e: String(e) });
  } finally {
    inflight.delete(raw);
  }
}

async function dispatch(addr: string, ev: TonApiEvent, a: TonApiAction): Promise<void> {
  switch (a.type) {
    case "JettonSwap":
      await alertQueue.add("event", { kind: "swap", addr, tx: ev.event_id, data: a.JettonSwap });
      break;
    case "JettonTransfer":
      await alertQueue.add("event", { kind: "transfer", addr, tx: ev.event_id, data: a.JettonTransfer });
      break;
    case "TonTransfer": {
      // Режем dust/служебные «0 TON» (спам при follow smart-money): не ставим в очередь.
      const amountTon = Number(a.TonTransfer?.amount ?? 0) / 1e9;
      if (amountTon < config.MIN_TON_TRANSFER) break;
      await alertQueue.add("event", { kind: "ton", addr, tx: ev.event_id, data: a.TonTransfer });
      break;
    }
  }
}

/**
 * Бэкфилл-поллер: подстраховка к SSE (ловит пропуски при реконнектах и обслуживает free-адреса,
 * для которых реал-тайм не нужен). Частота низкая — основную скорость даёт SSE.
 */
export function startPolling(repo: Repo, intervalMs = 60_000): NodeJS.Timeout {
  return setInterval(async () => {
    let addrs: { raw: string }[];
    try {
      // Если включён публичный канал — smart-money ингестим всегда (без Pro-подписчиков).
      addrs = await repo.allTrackedAddresses(undefined, !!config.CHANNEL_CHAT_ID);
    } catch (e) {
      logger.error("allTrackedAddresses failed", String(e));
      return;
    }
    for (const { raw } of addrs) await processAccount(repo, raw);
  }, intervalMs);
}
