import { Queue, Worker, type Processor } from "bullmq";
import { config } from "../config";

// Передаём BullMQ опции подключения (а не инстанс ioredis), чтобы он использовал
// собственную bundled-версию ioredis и не возникало конфликта типов двух пакетов.
const redisUrl = new URL(config.REDIS_URL);
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  maxRetriesPerRequest: null,
};

// Очередь алертов. Сюда ingest кладёт нормализованные события и новые листинги.
export const alertQueue = new Queue("alerts", { connection });

export type AlertJob =
  | { kind: "swap" | "transfer" | "ton"; addr: string; tx?: string; data: unknown }
  | { kind: "listing"; pool: unknown; safety?: unknown };

export function startAlertWorker(processor: Processor<AlertJob>) {
  return new Worker<AlertJob>("alerts", processor, { connection, concurrency: 8 });
}

// Хелпер для отложенной доставки free-юзерам (задержка ~12 мин).
export function enqueueDelayed(job: AlertJob, delayMs: number) {
  return alertQueue.add("delayed", job, { delay: delayMs });
}
