import { Bot, InlineKeyboard } from "grammy";
import type { Repo } from "../db/repo";
import { config } from "../config";
import { refundPayment } from "./payments";
import { discoverCandidates } from "../ingest/discovery";
import { rebuildSmartList } from "../ingest/smartmoney";
import { checkJettonSafety } from "../ingest/safety";
import { formatListing, formatSwap } from "../alerts/format";
import { SMART_LIST_NAME } from "../constants";
import { t, pickLang } from "../i18n";

export function registerCommands(bot: Bot, repo: Repo): void {
  bot.command("start", async (ctx) => {
    const lang = pickLang(ctx.from?.language_code);
    await repo.upsertUser(ctx.from!.id, ctx.from?.language_code);
    const kb = new InlineKeyboard().webApp(t(lang, "open_app"), config.WEBAPP_URL);
    await ctx.reply(t(lang, "start"), { parse_mode: "HTML", reply_markup: kb });
  });

  bot.command("pro", async (ctx) => {
    const lang = pickLang(ctx.from?.language_code);
    const kb = new InlineKeyboard().webApp(t(lang, "get_pro"), `${config.WEBAPP_URL}?upsell=pro`);
    await ctx.reply(t(lang, "pro_pitch"), { parse_mode: "HTML", reply_markup: kb });
  });

  bot.command("status", async (ctx) => {
    const lang = pickLang(ctx.from?.language_code);
    const u = await repo.getUser(ctx.from!.id);
    await ctx.reply(t(lang, "status", { tier: u?.tier ?? "free" }), { parse_mode: "HTML" });
  });

  bot.command("help", async (ctx) => {
    const lang = pickLang(ctx.from?.language_code);
    await ctx.reply(t(lang, "help"), { parse_mode: "HTML" });
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
      await ctx.reply(formatListing({ dex: "STON.fi", address: "test" }, safety, "en"), {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard().webApp(
          t("en", "buy_button"),
          `${config.WEBAPP_URL}?swap=${jetton}&lang=en`,
        ),
      });
    } catch (e) {
      await ctx.reply("Ошибка: " + String(e));
    }
  });

  // Геройский «демо-алерт» для записи видео (только администратор):
  // имитация «smart-money купил TOKEN» с кнопкой свопа.
  bot.command("demo", async (ctx) => {
    if (ctx.from!.id !== config.ADMIN_ID) return;
    const jetton = "EQAJ8uWd7EBqsmpSWaRdf_I-8R8-XHwh3gsNKhy-UrdrPcUo"; // HMSTR
    const sample = {
      dex: "stonfi",
      ton_in: 250 * 1e9,
      jetton_master_out: { address: jetton, symbol: "HMSTR" },
    };
    const text = formatSwap("EQChhrKIi_Ab-cwXfXw0pFMY1MwEGVfb2s6gwDKNuGZdolkm", sample, "en");
    await ctx.reply(text, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: new InlineKeyboard().webApp(
        t("en", "buy_button"),
        `${config.WEBAPP_URL}?swap=${jetton}&lang=en`,
      ),
    });
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
