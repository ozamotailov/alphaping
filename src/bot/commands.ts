import { Bot, InlineKeyboard } from "grammy";
import type { Repo } from "../db/repo";
import { config } from "../config";
import { PLANS, refundPayment } from "./payments";
import { discoverCandidates } from "../ingest/discovery";
import { rebuildSmartList } from "../ingest/smartmoney";
import { checkJettonSafety } from "../ingest/safety";
import { formatListing } from "../alerts/format";
import { SMART_LIST_NAME } from "../constants";

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

  bot.command("help", async (ctx) => {
    await ctx.reply(
      "<b>TonSonar</b> — алерты по smart-money и кошелькам TON.\n\n" +
        "<b>Как пользоваться:</b>\n" +
        "1. Открой приложение (кнопка меню слева от поля ввода).\n" +
        "2. Подключи TON-кошелёк → увидишь портфель и PnL.\n" +
        "3. Добавляй кошельки в отслеживание — будут алерты их сделок.\n" +
        "4. Смотри ленту новых jetton-листингов.\n\n" +
        "<b>Pro</b> (/pro): 50 кошельков, реал-тайм алерты, кураторские smart-money списки, без рекламы.\n\n" +
        "🔒 Только read-only адреса — приватные ключи мы никогда не запрашиваем.",
      { parse_mode: "HTML" },
    );
  });

  // Сервисная команда: вручную пересобрать smart-money список (только администратор).
  bot.command("rebuildsm", async (ctx) => {
    if (ctx.from!.id !== config.ADMIN_ID) return;
    await ctx.reply("Собираю кандидатов со STON.fi и пересобираю smart-money список…");
    try {
      const candidates = await discoverCandidates();
      const top = await rebuildSmartList(repo, SMART_LIST_NAME, candidates);
      await ctx.reply(`Готово: кандидатов ${candidates.length}, в списке ${top.length}.`);
    } catch (e) {
      await ctx.reply("Ошибка: " + String(e));
    }
  });

  // Диагностика листингов (только администратор).
  bot.command("liststatus", async (ctx) => {
    if (ctx.from!.id !== config.ADMIN_ID) return;
    const seen = await repo.poolsSeenCount();
    const subs = (await repo.proAndWhaleSubscribers()).length;
    await ctx.reply(
      "📡 Листинги:\n" +
        `• пулов в базе (seen): ${seen}\n` +
        `• мин. ликвидность: $${config.MIN_LIQUIDITY_USD}\n` +
        `• макс. новых за цикл: ${config.MAX_NEW_PER_CYCLE}\n` +
        `• опрос STON.fi: каждые 5 мин\n` +
        `• получателей (Pro/Whale): ${subs}`,
    );
  });

  // Тестовый листинг-алерт себе (проверка формата/доставки/кнопки свопа).
  bot.command("testlisting", async (ctx) => {
    if (ctx.from!.id !== config.ADMIN_ID) return;
    const jetton = "EQAJ8uWd7EBqsmpSWaRdf_I-8R8-XHwh3gsNKhy-UrdrPcUo"; // HMSTR
    try {
      const safety = await checkJettonSafety(jetton);
      await ctx.reply(formatListing({ dex: "STON.fi", address: "test" }, safety), {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().webApp(
          "🟢 Купить на STON.fi",
          `${config.WEBAPP_URL}?swap=${jetton}`,
        ),
      });
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
