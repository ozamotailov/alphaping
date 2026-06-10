import { config } from "./config";
import { Repo } from "./db/repo";
import { buildBot } from "./bot/bot";
import { createServer } from "./api/server";
import { startAlertWorker } from "./alerts/queue";
import { deliverAlert } from "./alerts/deliver";
import { startPolling } from "./ingest/tonapi";
import { startAccountStream } from "./ingest/tonapiStream";
import { startListingPolling } from "./ingest/stonfi";
import { logger } from "./lib/logger";

async function main() {
  const repo = new Repo();
  const bot = buildBot(repo);

  // 1) HTTP API для Mini App (инвойсы, watchlist, портфель)
  const app = createServer(bot, repo);
  app.listen(config.PORT, () => logger.info(`API listening on :${config.PORT}`));

  // 2) Воркер доставки алертов (BullMQ)
  startAlertWorker((job) => deliverAlert(bot, repo, job.data));

  // 3) Ingest: реал-тайм SSE (Pro/Whale) + бэкфилл-поллер + новые листинги STON.fi
  startAccountStream(repo); // tonapi SSE → мгновенные алерты по pro-адресам
  startPolling(repo, 60_000); // бэкфилл/подстраховка и free-адреса
  startListingPolling(repo); // ston.fi новые пулы → safety → очередь алертов

  // 4) Сервис: даунгрейд истёкших подписок раз в час
  setInterval(() => void repo.downgradeExpired(), 60 * 60 * 1000);

  // 5) Запуск бота (long polling; в проде переключите на webhook)
  await bot.start({
    onStart: (i) => logger.info(`bot @${i.username} started (long polling)`),
  });
}

main().catch((e) => {
  logger.error("fatal", String(e));
  process.exit(1);
});
