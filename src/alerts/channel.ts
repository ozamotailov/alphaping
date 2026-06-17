import { InlineKeyboard, type Bot } from "grammy";
import type { Repo } from "../db/repo";
import type { AlertJob } from "./queue";
import { config } from "../config";
import { logger } from "../lib/logger";

// Авто-постинг тизер-алертов в публичный канал (контент-движок / воронка привлечения).
// Канал кормится из того же потока событий, что и подписчики (см. deliver.ts),
// но: (1) постим ТОЛЬКО куратив-альфу — smart-money покупки + новые листинги
// (приватность: watched-кошельки юзеров сюда не попадают), (2) тизер, а не полный
// алерт (повод открыть бота: реалтайм + свои кошельки), (3) CTA — URL-кнопка с
// deep-link в бота (в каналах webApp-кнопки не работают), (4) анти-флуд.
// Канал публичный и одноязычный → тексты EN (как seed-посты в CHANNEL.md).

const MIN_INTERVAL_MS = 60 * 1000; // не чаще одного поста в минуту
const DEDUP_WINDOW_MS = 30 * 60 * 1000; // тот же jetton/пул не репостим 30 мин

let lastPostAt = 0;
const recent = new Map<string, number>();

// Глобальный троттл + дедуп по ключу. true → можно постить (и резервирует слот).
function allow(key: string): boolean {
  const now = Date.now();
  if (now - lastPostAt < MIN_INTERVAL_MS) return false;
  const last = recent.get(key) ?? 0;
  if (now - last < DEDUP_WINDOW_MS) return false;
  lastPostAt = now;
  recent.set(key, now);
  if (recent.size > 500) {
    for (const [k, ts] of recent) if (now - ts > DEDUP_WINDOW_MS) recent.delete(k);
  }
  return true;
}

let cachedUsername = "";
async function botUsername(bot: Bot): Promise<string> {
  if (cachedUsername) return cachedUsername;
  cachedUsername = (await bot.api.getMe()).username;
  return cachedUsername;
}

// Две URL-кнопки: «купить этот jetton» (deep-link на /start swap_<jetton>) + открыть бота.
async function ctaKeyboard(bot: Bot, jetton: string, sym?: string | null): Promise<InlineKeyboard> {
  const u = await botUsername(bot);
  const buyLabel = `🟢 Buy ${sym ? "$" + sym + " " : ""}on STON.fi`;
  return new InlineKeyboard()
    .url(buyLabel, `https://t.me/${u}?start=swap_${jetton}`)
    .row()
    .url("🛰 Open TonSonar", `https://t.me/${u}?start=ch`);
}

function swapTeaser(sym: string, ton: number): string {
  return (
    `🟢 <b>Smart money is buying</b>\n\n` +
    `A top-scored wallet just bought <b>$${sym}</b> (~${ton.toFixed(0)} TON) on STON.fi.\n\n` +
    `TonSonar pinged its followers in real time — with a one-tap swap right in the alert.`
  );
}

function listingTeaser(safety: any): string {
  const sym = safety?.symbol ? `<b>$${safety.symbol}</b>` : "A new jetton";
  const badge = safety?.badge ?? "⚪";
  const liq =
    safety?.liquidityUsd != null ? ` · liquidity ~$${Number(safety.liquidityUsd).toFixed(0)}` : "";
  return (
    `🚀 <b>New jetton listing</b> ${badge}\n\n` +
    `${sym} just listed on STON.fi${liq} — passed TonSonar's anti-scam check.\n\n` +
    `New listings, surfaced with a safety filter and a one-tap swap.`
  );
}

async function send(bot: Bot, text: string, kb?: InlineKeyboard): Promise<void> {
  await bot.api.sendMessage(config.CHANNEL_CHAT_ID!, text, {
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: kb,
  });
}

// Основной хук: вызывается воркером рядом с deliverAlert на каждое событие.
// Все ошибки гасим внутри — постинг в канал не должен ронять доставку подписчикам.
export async function postToChannel(bot: Bot, repo: Repo, job: AlertJob): Promise<void> {
  if (!config.CHANNEL_CHAT_ID) return; // авто-постинг выключен
  if ((job as any).__delayed) return; // отложенный проход (free) — не дублируем в канал
  try {
    if (job.kind === "listing") {
      const safety = (job as any).safety;
      const jetton: string | undefined = safety?.address;
      if (!jetton) return;
      if (!allow(`listing:${jetton}`)) return;
      await send(bot, listingTeaser(safety), await ctaKeyboard(bot, jetton, safety?.symbol));
      return;
    }

    if (job.kind === "swap") {
      const d: any = (job as any).data;
      const isBuy = d?.jetton_master_out && d?.ton_in; // покупка jetton за TON
      if (!isBuy) return;
      const ton = Number(d.ton_in) / 1e9;
      if (ton < config.CHANNEL_MIN_TON) return;
      // Приватность-гейт: постим ТОЛЬКО участников курируемого smart-money списка.
      if (!(await repo.isSmartMoneyMember(job.addr))) return;
      const jetton: string = d.jetton_master_out.address;
      const sym: string = d.jetton_master_out.symbol ?? "?";
      if (!allow(`swap:${jetton}`)) return;
      await send(bot, swapTeaser(sym, ton), await ctaKeyboard(bot, jetton, sym));
      return;
    }
  } catch (e) {
    logger.warn("channel post failed", String(e));
  }
}

// Тестовый пост (админ-команда /testchannel): шлёт образец smart-money тизера в канал,
// в обход анти-флуда — для проверки прав бота и вёрстки без ожидания живого сигнала.
export async function postSampleToChannel(bot: Bot): Promise<void> {
  const jetton = "EQAJ8uWd7EBqsmpSWaRdf_I-8R8-XHwh3gsNKhy-UrdrPcUo"; // HMSTR
  await send(bot, swapTeaser("HMSTR", 250), await ctaKeyboard(bot, jetton, "HMSTR"));
}
