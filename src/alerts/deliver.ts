import { InlineKeyboard, type Bot } from "grammy";
import type { Repo } from "../db/repo";
import type { AlertJob } from "./queue";
import { enqueueDelayed } from "./queue";
import { formatSwap, formatTransfer, formatTon, formatListing } from "./format";
import { config } from "../config";
import { t, pickLang, type Lang } from "../i18n";
import { logger } from "../lib/logger";

const FREE_DELAY_MS = 12 * 60 * 1000; // задержка алертов для free-тарифа

// Кнопка «Купить на STON.fi» → открывает Mini App на свопе этого jetton (deep-link ?swap=).
function swapKeyboard(jetton: string, lang: Lang): InlineKeyboard {
  return new InlineKeyboard().webApp(t(lang, "buy_button"), `${config.WEBAPP_URL}?swap=${jetton}`);
}

// Доставка одного задания алерта подписчикам.
// Free-юзеры получают тот же алерт с задержкой: на «немедленном» проходе мы рассылаем
// pro/whale и кладём ОДНО отложенное задание; на «отложенном» проходе — только free.
export async function deliverAlert(bot: Bot, repo: Repo, job: AlertJob): Promise<void> {
  try {
    if (job.kind === "listing") {
      const ids = await repo.proAndWhaleSubscribers(); // новые листинги — только Pro/Whale
      const addr = (job as any).safety?.address as string | undefined;
      for (const id of ids) {
        const lang = pickLang(id.language_code);
        const text = formatListing((job as any).pool, (job as any).safety, lang);
        const kb = addr ? swapKeyboard(addr, lang) : undefined;
        await safeSend(bot, id.tg_id, text, kb);
      }
      return;
    }

    const subs = await repo.subscribersWatching(job.addr);
    const delayedPass = Boolean((job as any).__delayed);
    // Для buy-свопа (получен jetton за TON) даём кнопку «купить тот же jetton».
    const buyJetton =
      job.kind === "swap" ? ((job as any).data?.jetton_master_out?.address as string | undefined) : undefined;

    const seen = new Set<number>();
    for (const s of subs) {
      if (seen.has(s.tg_id)) continue; // один юзер может попасть и через watch, и через follow
      seen.add(s.tg_id);
      if (!passesFilters(s.filters, job)) continue;
      const isFree = s.tier === "free";
      const lang = pickLang(s.language_code); // алерт на языке получателя
      const text = render(job, lang);
      const kb = buyJetton ? swapKeyboard(buyJetton, lang) : undefined;
      if (delayedPass) {
        if (isFree) await safeSend(bot, s.tg_id, text, kb); // на отложенном проходе — только free
      } else if (!isFree) {
        await safeSend(bot, s.tg_id, text, kb); // pro/whale — сразу
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

function render(job: AlertJob, lang: Lang): string {
  switch (job.kind) {
    case "swap":
      return formatSwap(job.addr, (job as any).data, lang);
    case "transfer":
      return formatTransfer(job.addr, (job as any).data, lang);
    case "ton":
      return formatTon(job.addr, (job as any).data, lang);
    default:
      return "";
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

async function safeSend(bot: Bot, chatId: number, text: string, keyboard?: InlineKeyboard) {
  try {
    await bot.api.sendMessage(chatId, text, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: keyboard,
    });
  } catch (e) {
    logger.warn("send failed", { chatId, e: String(e) });
  }
}
