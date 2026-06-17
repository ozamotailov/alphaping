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

const toSeen = (p: StonPool) => ({
  address: p.address,
  dex: "stonfi",
  token0: p.token0_address,
  token1: p.token1_address,
});

// «Решить» пул: перенести в pools_seen (больше не оцениваем) и убрать из pending.
async function resolvePool(repo: Repo, p: StonPool): Promise<void> {
  await repo.markPoolSeen(toSeen(p));
  await repo.removePendingPool(p.address);
}

/**
 * Детект новых jetton-листингов с ОКНОМ ПЕРЕОЦЕНКИ.
 * Новый пул не списывается сразу: если ликвидности пока мало, держим его в pools_pending
 * и переоцениваем каждый цикл — алертим, когда он перерастает порог (это и есть «свежий
 * токен набирает обороты»). Пул «решается» (→ pools_seen) когда: заалертили, оказался
 * high-risk, не-листинг (пара котировочных), или истекло окно LISTING_WINDOW_HOURS.
 */
export async function pollNewPools(repo: Repo): Promise<void> {
  let pools: StonPool[];
  try {
    pools = await fetchPools();
  } catch (e) {
    logger.warn("ston.fi pools failed", String(e));
    return;
  }

  const resolved = new Set(await repo.allSeenPoolAddresses());
  const pending = new Map((await repo.getPendingPools()).map((r) => [r.address, r.first_seen]));

  // Кандидаты на оценку = всё, что ещё не «решено». Включает и pending, и впервые увиденные.
  const candidates = pools.filter((p) => p.address && !resolved.has(p.address));
  if (candidates.length === 0) return;

  // Анти-флуд: аномально много ВПЕРВЫЕ увиденных за цикл = пропущенный базлайн
  // (напр. пустой pools_seen). Списываем их seen без алертов; pending не трогаем.
  const firstTime = candidates.filter((p) => !pending.has(p.address));
  if (firstTime.length > config.MAX_NEW_PER_CYCLE) {
    await repo.markPoolsSeenBulk(firstTime.map(toSeen));
    logger.warn(
      `listing: ${firstTime.length} впервые увиденных пулов за цикл (> ${config.MAX_NEW_PER_CYCLE}) — аномалия/базлайн, помечаю seen без алертов`,
    );
    return;
  }

  const now = Date.now();
  const windowMs = config.LISTING_WINDOW_HOURS * 3600_000;

  for (const p of candidates) {
    const jetton = pickNewJetton(p);
    if (!jetton) {
      await resolvePool(repo, p); // обе стороны котировочные (USDT/TON) — не листинг
      continue;
    }

    // Ликвидность берём прямо из данных STON.fi (без tonapi).
    const liq = Number(p.lp_total_supply_usd ?? 0);
    if (liq >= config.MIN_LIQUIDITY_USD) {
      const safety = await checkJettonSafety(jetton, p);
      await repo.setJettonSafety(jetton, safety.symbol, safety);
      if (safety.risk === "high") {
        logger.info(`listing skipped (high risk): ${safety.symbol ?? jetton} — ${safety.reasons.join("; ")}`);
      } else {
        await alertQueue.add("listing", { kind: "listing", pool: { ...p, dex: "STON.fi" }, safety });
      }
      await resolvePool(repo, p); // заалертили или high-risk — больше не ждём
      continue;
    }

    // Ликвидности пока мало: держим под наблюдением в пределах окна.
    const firstSeen = pending.get(p.address) ?? now;
    if (now - firstSeen > windowMs) {
      await resolvePool(repo, p); // не дорос за окно — перестаём ждать
    } else if (!pending.has(p.address)) {
      await repo.upsertPendingPool({
        address: p.address,
        dex: "stonfi",
        token0: p.token0_address,
        token1: p.token1_address,
        firstSeen: now,
      });
    }
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
