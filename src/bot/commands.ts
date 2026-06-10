import { Bot, InlineKeyboard } from "grammy";
import type { Repo } from "../db/repo";
import { config } from "../config";
import { PLANS, refundPayment } from "./payments";
import { discoverCandidates } from "../ingest/discovery";
import { rebuildSmartList } from "../ingest/smartmoney";

export function registerCommands(bot: Bot, repo: Repo): void {
  bot.command("start", async (ctx) => {
    await repo.upsertUser(ctx.from!.id);
    const kb = new InlineKeyboard().webApp("🛰️ Открыть TonSonar", config.WEBAPP_URL);
    await ctx.reply(
      "Привет! <b>TonSonar</b> следит за TON-кошельками и smart-money прямо в Telegram.\n\n" +
        "• Портфель и PnL по твоему TON-кошельку\n" +
        "• Алерты сделок отслеживаемых кошельков\n" +
        "• Новые jetton-листинги на STON.fi / DeDust\n\n" +
        "Открой приложение и добавь первый кошелёк 👇",
      { parse_mode: "HTML", reply_markup: kb },
    );
  });

  bot.command("pro", async (ctx) => {
    const kb = new InlineKeyboard().webApp("⭐ Оформить Pro", `${config.WEBAPP_URL}?upsell=pro`);
    await ctx.reply(
      `<b>${PLANS.pro.title}</b> — ${PLANS.pro.stars}⭐/мес:\n` +
        "50 кошельков · реал-тайм · кураторские smart-money списки · без рекламы.",
      { parse_mode: "HTML", reply_markup: kb },
    );
  });

  bot.command("status", async (ctx) => {
    const u = await repo.getUser(ctx.from!.id);
    await ctx.reply(`Тариф: <b>${u?.tier ?? "free"}</b>`, { parse_mode: "HTML" });
  });

  // Сервисная команда: вручную пересобрать smart-money список (только администратор).
  bot.command("rebuildsm", async (ctx) => {
    if (ctx.from!.id !== config.ADMIN_ID) return;
    await ctx.reply("Собираю кандидатов со STON.fi и пересобираю smart-money список…");
    try {
      const candidates = await discoverCandidates();
      const top = await rebuildSmartList(repo, "TON Smart Money", candidates);
      await ctx.reply(`Готово: кандидатов ${candidates.length}, в списке ${top.length}.`);
    } catch (e) {
      await ctx.reply("Ошибка: " + String(e));
    }
  });

  // Сервисная команда возврата (только администратор). Использование: /refund <charge_id>
  bot.command("refund", async (ctx) => {
    if (ctx.from!.id !== config.ADMIN_ID) return;
    const chargeId = ctx.match.trim();
    if (!chargeId) return ctx.reply("Использование: /refund <telegram_payment_charge_id>");
    try {
      await refundPayment(bot, ctx.from!.id, chargeId);
      await ctx.reply("Возврат выполнен.");
    } catch (e) {
      await ctx.reply("Ошибка возврата: " + String(e));
    }
  });
}
