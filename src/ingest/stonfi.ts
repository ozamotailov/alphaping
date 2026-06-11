import { alertQueue } from "../alerts/queue";
import type { Repo } from "../db/repo";
import { config } from "../config";
import { logger } from "../lib/logger";
import { checkJettonSafety } from "./safety";
import { normalizeAddress } from "../lib/ton";

const STON = "https://api.ston.fi/v1";

// Котировочные активы (TON-сторона пары): нативный TON, pTON, USD₮.
// Новый листинг — это ДРУГОЙ токен пары. Сравниваем по нормализованному raw-адресу.
const KNOWN_QUOTES_RAW = new Set(
  [
    "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c", // native TON / zero
    "EQCM3B12QK1e4yZSf8GtBRT0aLMNyEsBc_DhVfRRtOEffLez", // pTON v1
    "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs", // USD₮ (Tether on TON)
  ]
    .map((a) => normalizeAddress(a)?.raw)
    .filter((x): x is string => !!x),
);

function isQuote(addr: string): boolean {
  return KNOWN_QUOTES_RAW.has(normalizeAddress(addr)?.raw ?? addr);
}

interface StonPool {
  address: string;
  token0_address?: string;
  token1_address?: string;
  lp_total_supply_usd?: string;
}

async function fetchPools(): Promise<StonPool[]> {
  const r = await fetch(`${STON}/pools`);
  if (!r.ok) throw new Error(`ston.fi ${r.status}`);
  const body = (await r.json()) as { pool_list?: StonPool[] };
  return body.pool_list ?? [];
}

/**
 * Базлайн: на самом первом запуске помечаем все текущие пулы как «виденные» БЕЗ алертов.
 * Иначе первый diff принял бы все 45k+ существующих пулов за «новые» и устроил флуд.
 * При перезапусках (pools_seen не пуст) — быстрый выход.
 */
export async function seedListingBaselineIfEmpty(repo: Repo): Promise<void> {
  if ((await repo.poolsSeenCount()) > 0) return;
  try {
    const pools = await fetchPools();
    await repo.markPoolsSeenBulk(
      pools.map((p) => ({ address: p.address, dex: "stonfi", token0: p.token0_address, token1: p.token1_address })),
    );
    logger.info(`listing baseline: засеяно ${pools.length} существующих пулов (без алертов)`);
  } catch (e) {
    logger.warn("seed baseline failed", String(e));
  }
}

/**
 * Детект новых jetton-листингов: diff пулов STON.fi относительно pools_seen.
 * Новый пул → safety-проверка → алерт ТОЛЬКО при risk != high.
 */
export async function pollNewPools(repo: Repo): Promise<void> {
  let pools: StonPool[];
  try {
    pools = await fetchPools();
  } catch (e) {
    logger.warn("ston.fi pools failed", String(e));
    return;
  }

  // Один запрос вместо 45k: множество уже виденных пулов держим в памяти.
  const seen = new Set(await repo.allSeenPoolAddresses());
  const fresh = pools.filter((p) => p.address && !seen.has(p.address));
  if (fresh.length === 0) return;

  const toSeen = (p: StonPool) => ({
    address: p.address,
    dex: "stonfi",
    token0: p.token0_address,
    token1: p.token1_address,
  });

  // Анти-флуд: слишком много «новых» за цикл = аномалия/пропущенный базлайн
  // (напр. пустой pools_seen). Помечаем seen БЕЗ алертов, чтобы не залить пользователей.
  if (fresh.length > config.MAX_NEW_PER_CYCLE) {
    await repo.markPoolsSeenBulk(fresh.map(toSeen));
    logger.warn(
      `listing: ${fresh.length} новых пулов за цикл (> ${config.MAX_NEW_PER_CYCLE}) — аномалия/базлайн, помечаю seen без алертов`,
    );
    return;
  }

  for (const p of fresh) {
    await repo.markPoolSeen(toSeen(p));

    // Фильтр мусора: низкая ликвидность пула (берём прямо из данных STON.fi, без tonapi).
    const liq = Number(p.lp_total_supply_usd ?? 0);
    if (!(liq >= config.MIN_LIQUIDITY_USD)) {
      logger.info(`listing skipped (low liq ~$${liq.toFixed(0)} < $${config.MIN_LIQUIDITY_USD}): ${p.address}`);
      continue;
    }

    const jetton = pickNewJetton(p);
    if (!jetton) continue; // обе стороны котировочные (напр. USDT/TON) — не новый листинг

    const safety = await checkJettonSafety(jetton, p);
    await repo.setJettonSafety(jetton, safety.symbol, safety);

    if (safety.risk === "high") {
      logger.info(`listing skipped (high risk): ${safety.symbol ?? jetton} — ${safety.reasons.join("; ")}`);
      continue;
    }
    await alertQueue.add("listing", { kind: "listing", pool: { ...p, dex: "STON.fi" }, safety });
  }
}

function pickNewJetton(p: StonPool): string | null {
  const t0 = p.token0_address;
  const t1 = p.token1_address;
  if (t0 && !isQuote(t0)) return t0;
  if (t1 && !isQuote(t1)) return t1;
  return null;
}

// /v1/pools отдаёт ~44 МБ (все пулы), поэтому опрашиваем нечасто. Для прод-нагрузки
// уместнее индексатор/стрим новых пулов, но для MVP diff раз в 5 минут достаточно.
export function startListingPolling(repo: Repo, intervalMs = 5 * 60_000): NodeJS.Timeout {
  return setInterval(() => void pollNewPools(repo), intervalMs);
}
