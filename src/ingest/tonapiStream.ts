import type { Repo } from "../db/repo";
import { logger } from "../lib/logger";
import { streamAccountTransactions } from "./tonapiClient";
import { processAccount } from "./tonapi";
import { normalizeAddress } from "../lib/ton";

// Максимум адресов на одно SSE-соединение (tonapi ограничивает длину списка) — чанкуем.
const CHUNK = 100;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Менеджер реал-тайм SSE-стрима для Pro/Whale адресов.
 * - периодически сверяет актуальный набор адресов; при изменении переподключается;
 * - на каждое событие мгновенно дергает processAccount (тот сам тянет декодированные actions);
 * - реконнект с экспоненциальным backoff.
 */
export function startAccountStream(repo: Repo, refreshMs = 30_000): NodeJS.Timeout {
  let controller: AbortController | null = null;
  let currentKey = "";

  async function refresh(): Promise<void> {
    let rows: { raw: string }[];
    try {
      rows = await repo.proTrackedAddresses();
    } catch (e) {
      logger.error("proTrackedAddresses failed", String(e));
      return;
    }
    const addrs = rows.map((r) => r.raw).sort();
    const key = addrs.join(",");
    if (key === currentKey) return; // набор не изменился

    currentKey = key;
    controller?.abort();
    if (addrs.length === 0) {
      controller = null;
      return;
    }
    controller = new AbortController();
    const signal = controller.signal;
    for (let i = 0; i < addrs.length; i += CHUNK) {
      void connectLoop(addrs.slice(i, i + CHUNK), signal);
    }
    logger.info(`SSE: ${addrs.length} pro-адресов в ${Math.ceil(addrs.length / CHUNK)} соединении(ях)`);
  }

  async function connectLoop(accounts: string[], signal: AbortSignal): Promise<void> {
    let backoff = 1000;
    while (!signal.aborted) {
      try {
        await streamAccountTransactions(
          accounts,
          (id) => void processAccount(repo, normalizeAddress(id)?.raw ?? id),
          signal,
        );
        backoff = 1000; // поток корректно завершился → переподключаемся
      } catch (e) {
        if (signal.aborted) return;
        logger.warn("SSE reconnect", String(e));
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 30_000);
      }
    }
  }

  const timer = setInterval(() => void refresh(), refreshMs);
  void refresh();
  return timer;
}
