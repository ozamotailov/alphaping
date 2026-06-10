import type { Bot } from "grammy";
import type { Repo } from "../db/repo";
import type { AlertJob } from "./queue";
import { enqueueDelayed } from "./queue";
import { formatSwap, formatTransfer, formatTon, formatListing } from "./format";
import { logger } from "../lib/logger";

const FREE_DELAY_MS = 12 * 60 * 1000; // задержка алертов для free-тарифа

// Доставка одного задания алерта подписчикам.
// Free-юзеры получают тот же алерт с задержкой: на «немедленном» проходе мы рассылаем
// pro/whale и кладём ОДНО отложенное задание; на «отложенном» проходе — только free.
export async function deliverAlert(bot: Bot, repo: Repo, job: AlertJob): Promise<void> {
  try {
    if (job.kind === "listing") {
      const ids = await repo.proAndWhaleSubscribers(); // новые листинги — только Pro/Whale
      const text = formatListing((job as any).pool, (job as any).safety);
      for (const id of ids) await safeSend(bot, id, text);
      return;
    }

    const subs = await repo.subscribersWatching(job.addr);
    const text = render(job);
    const delayedPass = Boolean((job as any).__delayed);

    const seen = new Set<number>();
    for (const s of subs) {
      if (seen.has(s.tg_id)) continue; // один юзер может попасть и через watch, и через follow
      seen.add(s.tg_id);
      if (!passesFilters(s.filters, job)) continue;
      const isFree = s.tier === "free";
      if (delayedPass) {
        if (isFree) await safeSend(bot, s.tg_id, text); // на отложенном проходе — только free
      } else if (!isFree) {
        await safeSend(bot, s.tg_id, text); // pro/whale — сразу
      }
    }

    // Один раз ставим отложенную доставку для free (если такие подписчики есть).
    if (!delayedPass && subs.some((s) => s.tier === "free")) {
      await enqueueDelayed({ ...job, __delayed: true } as AlertJob, FREE_DELAY_MS);
    }
  } catch (e) {
    logger.error("deliver error", String(e));
  }
}

function render(job: AlertJob): string {
  switch (job.kind) {
    case "swap":
      return formatSwap(job.addr, (job as any).data);
    case "transfer":
      return formatTransfer(job.addr, (job as any).data);
    case "ton":
      return formatTon(job.addr, (job as any).data);
    default:
      return "Новое событие";
  }
}

function passesFilters(filters: any, job: AlertJob): boolean {
  if (!filters || job.kind === "listing") return true;
  // Фильтр по размеру сделки в TON (TON-нога свопа). minTon задаётся в filters.
  const minTon = Number(filters.minTon ?? 0);
  if (minTon > 0 && job.kind === "swap") {
    const d: any = (job as any).data;
    const ton = Number(d?.ton_in ?? d?.ton_out ?? 0) / 1e9;
    if (ton > 0 && ton < minTon) return false;
  }
  return true;
}

async function safeSend(bot: Bot, chatId: number, text: string) {
  try {
    await bot.api.sendMessage(chatId, text, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
  } catch (e) {
    logger.warn("send failed", { chatId, e: String(e) });
  }
}
