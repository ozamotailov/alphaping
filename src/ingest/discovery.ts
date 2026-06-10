import { logger } from "../lib/logger";

const STON = "https://api.ston.fi/v1";

interface StonOperation {
  operation_type: string; // "swap" | ...
  success: boolean;
  wallet_address?: string; // EQ... — адрес трейдера (то, что нам нужно)
  pool_tx_timestamp?: string;
}
interface StonOpsResponse {
  operations?: { operation: StonOperation }[];
}

// STON.fi принимает время в формате "YYYY-MM-DDTHH:mm:ss" (UTC).
function fmt(d: Date): string {
  return d.toISOString().slice(0, 19);
}

/**
 * Источник кандидатов в smart-money: активные свопперы STON.fi за последнее окно.
 * Возвращает distinct EQ-адреса, отсортированные по числу сделок в окне (убыв.),
 * с отсечкой подозрительно гиперактивных (боты/маркет-мейкеры) и лимитом.
 *
 * Сам по себе список — это лишь «активные», «умными» их делает последующий scoreWallet (ROI/win-rate).
 */
export async function discoverCandidates(
  opts: { windowMinutes?: number; maxCandidates?: number; maxTradesInWindow?: number } = {},
): Promise<string[]> {
  const windowMinutes = opts.windowMinutes ?? 60;
  const maxCandidates = opts.maxCandidates ?? 80;
  const maxTrades = opts.maxTradesInWindow ?? 50;

  const until = new Date();
  const since = new Date(until.getTime() - windowMinutes * 60_000);
  const url = `${STON}/stats/operations?since=${fmt(since)}&until=${fmt(until)}`;

  let rows: { operation: StonOperation }[];
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`ston.fi ${r.status}`);
    const body = (await r.json()) as StonOpsResponse;
    rows = body.operations ?? [];
  } catch (e) {
    logger.warn("discoverCandidates failed", String(e));
    return [];
  }

  const counts = new Map<string, number>();
  for (const { operation: op } of rows) {
    if (op.operation_type !== "swap" || !op.success) continue;
    const w = op.wallet_address;
    if (!w || isZeroish(w)) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }

  const ranked = [...counts.entries()]
    .filter(([, n]) => n <= maxTrades) // отсекаем явных ботов/MM с аномальной частотой
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxCandidates)
    .map(([addr]) => addr);

  logger.info(
    `discovery: ${rows.length} операций → ${counts.size} уник. кошельков → ${ranked.length} кандидатов`,
  );
  return ranked;
}

// Грубый фильтр «нулевого»/служебного адреса.
function isZeroish(a: string): boolean {
  return /AAAAAAAAAAAAAAAA/.test(a);
}
