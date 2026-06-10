import { alertQueue } from "../alerts/queue";
import type { Repo } from "../db/repo";
import { logger } from "../lib/logger";
import { checkJettonSafety } from "./safety";

const STON = "https://api.ston.fi/v1";

// Известные «котировочные» активы (TON-сторона пары). Новым считаем ДРУГОЙ токен.
// TODO: уточнить адреса pTON/USDT под актуальные значения STON.fi.
const KNOWN_QUOTES = new Set<string>([
  // pTON, USDT и т.п. — заполните реальными raw-адресами
]);

interface StonPool {
  address: string;
  token0_address?: string;
  token1_address?: string;
  tvl_usd?: number;
}

/**
 * Детект новых jetton-листингов: diff пулов STON.fi. На новый пул прогоняем safety-проверку
 * и публикуем алерт ТОЛЬКО при risk != high (чтобы не быть усилителем скама); high — лишь логируем/храним.
 */
export async function pollNewPools(repo: Repo): Promise<void> {
  let pools: StonPool[];
  try {
    const r = await fetch(`${STON}/pools`);
    if (!r.ok) throw new Error(`ston.fi ${r.status}`);
    const body = (await r.json()) as { pool_list?: StonPool[] };
    pools = body.pool_list ?? [];
  } catch (e) {
    logger.warn("ston.fi pools failed", String(e));
    return;
  }

  for (const p of pools) {
    if (!p.address || (await repo.poolSeen(p.address))) continue;
    await repo.markPoolSeen({
      address: p.address,
      dex: "stonfi",
      token0: p.token0_address,
      token1: p.token1_address,
    });

    const jetton = pickNewJetton(p);
    if (!jetton) continue;

    const safety = await checkJettonSafety(jetton, p);
    await repo.setJettonSafety(jetton, safety.symbol, safety);

    if (safety.risk === "high") {
      logger.info(`listing skipped (high risk): ${safety.symbol ?? jetton} — ${safety.reasons.join("; ")}`);
      continue; // не публикуем заведомо опасные запуски
    }

    await alertQueue.add("listing", {
      kind: "listing",
      pool: { ...p, dex: "STON.fi" },
      safety,
    });
  }
}

function pickNewJetton(p: StonPool): string | null {
  const t0 = p.token0_address;
  const t1 = p.token1_address;
  if (t0 && !KNOWN_QUOTES.has(t0)) return t0;
  if (t1 && !KNOWN_QUOTES.has(t1)) return t1;
  return t0 ?? t1 ?? null;
}

export function startListingPolling(repo: Repo, intervalMs = 60_000): NodeJS.Timeout {
  return setInterval(() => void pollNewPools(repo), intervalMs);
}
