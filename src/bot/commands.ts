import { Bot, InlineKeyboard } from "grammy";
import type { Repo } from "../db/repo";
import { config } from "../config";
import { refundPayment } from "./payments";
import { discoverCandidates } from "../ingest/discovery";
import { rebuildSmartList } from "../ingest/smartmoney";
import { checkJettonSafety } from "../ingest/safety";
import { formatListing, formatSwap } from "../alerts/format";
import { postSampleToChannel } from "../alerts/channel";
import { SMART_LIST_NAME } from "../constants";
import { configureBotProfile } from "./profile";
import { t, pickLang } from "../i18n";

export function registerCommands(bot: Bot, repo: Repo): void {
  // Язык юзера: явный выбор (/lang, хранится в БД) > детект Telegram. По умолчанию EN.
  const resolveLang = async (tgId: number, fallback?: string) =>
    pickLang((await repo.getUser(tgId))?.language_code ?? fallback);

  bot.command("start", async (ctx) => {
    await repo.upsertUser(ctx.from!.id, ctx.from?.language_code);
    const lang = await resolveLang(ctx.from!.id, ctx.from?.language_code);
    // Deep-link из канала: /start swap_<jetton> → сразу webApp-кнопка на своп этого jetton
    // (в личке webApp работает, в отличие от канала). Замыкает «тизер в канале → своп».
    const payload = (ctx.match || "").toString().trim();
    if (payload.startsWith("swap_")) {
      const jetton = payload.slice("swap_".length);
      const kb = new InlineKeyboard().webApp(t(lang, "buy_button"), `${config.WEBAPP_URL}?swap=${jetton}`);
      if (config.CHANNEL_URL?.startsWith("http")) kb.row().url(t(lang, "channel_btn"), config.CHANNEL_URL);
      await ctx.reply(t(lang, "start"), { parse_mode: "HTML", reply_markup: kb });
      return;
    }
    const kb = new InlineKeyboard().webApp(t(lang, "open_app"), config.WEBAPP_URL);
    if (config.CHANNEL_URL?.startsWith("http")) kb.row().url(t(lang, "channel_btn"), config.CHANNEL_URL);
    await ctx.reply(t(lang, "start"), { parse_mode: "HTML", reply_markup: kb });
  });

  // Ручной выбор языка: /lang en  ·  /lang ru
  bot.command("lang", async (ctx) => {
    const arg = (ctx.match || "").trim().toLowerCase();
    const choice = arg.startsWith("ru") ? "ru" : arg.startsWith("en") ? "en" : null;
    if (!choice) {
      await ctx.reply("Usage: /lang en  ·  /lang ru");
      return;
    }
    await repo.upsertUser(ctx.from!.id);
    await repo.setLanguage(ctx.from!.id, choice);
    await ctx.reply(choice === "en" ? "✅ Language set to English." : "✅ Язык переключён на русский.");
  });

  bot.command("pro", async (ctx) => {
    const lang = await resolveLang(ctx.from!.id, ctx.from?.language_code);
    const kb = new InlineKeyboard().webApp(t(lang, "get_pro"), `${config.WEBAPP_URL}?upsell=pro`);
    await ctx.reply(t(lang, "pro_pitch"), { parse_mode: "HTML", reply_markup: kb });
  });

  bot.command("status", async (ctx) => {
    const lang = await resolveLang(ctx.from!.id, ctx.from?.language_code);
    const u = await repo.getUser(ctx.from!.id);
    await ctx.reply(t(lang, "status", { tier: u?.tier ?? "free" }), { parse_mode: "HTML" });
  });

  bot.command("help", async (ctx) => {
    const lang = await resolveLang(ctx.from!.id, ctx.from?.language_code);
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

  // Тест постинга в публичный канал (только администратор): шлёт образец smart-money
  // тизера в CHANNEL_CHAT_ID. Проверка прав бота и вёрстки без ожидания живого сигнала.
  bot.command("testchannel", async (ctx) => {
    if (ctx.from!.id !== config.ADMIN_ID) return;
    if (!config.CHANNEL_CHAT_ID) {
      await ctx.reply("CHANNEL_CHAT_ID не задан — авто-постинг в канал выключен.");
      return;
    }
    try {
      await postSampleToChannel(bot);
      await ctx.reply(`✅ Тестовый пост отправлен в ${config.CHANNEL_CHAT_ID}.`);
    } catch (e) {
      await ctx.reply(
        "❌ Не удалось запостить в канал: " +
          String(e) +
          "\n\nПроверь: бот добавлен в канал АДМИНОМ с правом постинга, и CHANNEL_CHAT_ID верный (@username или числовой id).",
      );
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

  // Тестовый листинг-алерт себе с задержкой (для записи видео): удаляем команду,
  // через N секунд (по умолчанию 10, можно `/testlisting 5`) алерт приходит «нативно».
  bot.command("testlisting", async (ctx) => {
    if (ctx.from!.id !== config.ADMIN_ID) return;
    const chatId = ctx.chat!.id;
    const sec = Math.min(60, Math.max(0, Number(ctx.match) || 10));
    try {
      await ctx.deleteMessage();
    } catch {
      /* нет прав — удалишь вручную за время задержки */
    }
    const jetton = "EQAJ8uWd7EBqsmpSWaRdf_I-8R8-XHwh3gsNKhy-UrdrPcUo"; // HMSTR
    let text: string;
    try {
      const safety = await checkJettonSafety(jetton);
      text = formatListing({ dex: "STON.fi", address: "test" }, safety, "en");
    } catch (e) {
      await ctx.api.sendMessage(chatId, "Ошибка: " + String(e));
      return;
    }
    const kb = new InlineKeyboard().webApp(
      t("en", "buy_button"),
      `${config.WEBAPP_URL}?swap=${jetton}&lang=en`,
    );
    setTimeout(() => {
      void ctx.api
        .sendMessage(chatId, text, {
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
          reply_markup: kb,
        })
        .catch(() => {});
    }, sec * 1000);
  });

  // Геройский «демо-алерт» для записи видео (только администратор):
  // имитация «smart-money купил TOKEN» с кнопкой свопа.
  bot.command("demo", async (ctx) => {
    if (ctx.from!.id !== config.ADMIN_ID) return;
    const chatId = ctx.chat!.id;
    // Удаляем саму команду /demo, чтобы в записи не осталось следа (в личке бот это умеет).
    try {
      await ctx.deleteMessage();
    } catch {
      /* нет прав — удалишь вручную за время задержки */
    }
    const jetton = "EQAJ8uWd7EBqsmpSWaRdf_I-8R8-XHwh3gsNKhy-UrdrPcUo"; // HMSTR
    const sample = {
      dex: "stonfi",
      ton_in: 250 * 1e9,
      jetton_master_out: { address: jetton, symbol: "HMSTR" },
    };
    const text = formatSwap("EQChhrKIi_Ab-cwXfXw0pFMY1MwEGVfb2s6gwDKNuGZdolkm", sample, "en");
    const kb = new InlineKeyboard().webApp(
      t("en", "buy_button"),
      `${config.WEBAPP_URL}?swap=${jetton}&lang=en`,
    );
    // Задержка (по умолчанию 10с, можно `/demo 5`): алерт приходит «нативно» для записи.
    const sec = Math.min(60, Math.max(0, Number(ctx.match) || 10));
    setTimeout(() => {
      void ctx.api
        .sendMessage(chatId, text, {
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
          reply_markup: kb,
        })
        .catch(() => {});
    }, sec * 1000);
  });

  // Что реально хранит Telegram в профиле бота (для диагностики кэша описания).
  bot.command("profilecheck", async (ctx) => {
    if (ctx.from!.id !== config.ADMIN_ID) return;
    const cut = (s?: string) => (s && s.length ? s.slice(0, 60) : "(empty)");
    const [def, ru, sdef, sru, name] = await Promise.all([
      bot.api.getMyDescription(),
      bot.api.getMyDescription({ language_code: "ru" }),
      bot.api.getMyShortDescription(),
      bot.api.getMyShortDescription({ language_code: "ru" }),
      bot.api.getMyName(),
    ]);
    await ctx.reply(
      `name: ${cut(name.name)}\n\n` +
        `desc[default]: ${cut(def.description)}\n\n` +
        `desc[ru]: ${cut(ru.description)}\n\n` +
        `short[default]: ${cut(sdef.short_description)}\n` +
        `short[ru]: ${cut(sru.short_description)}`,
    );
  });

  // Переприменить профиль бота на лету (без передеплоя).
  bot.command("applyprofile", async (ctx) => {
    if (ctx.from!.id !== config.ADMIN_ID) return;
    await configureBotProfile(bot);
    await ctx.reply("Profile re-applied. Run /profilecheck to verify.");
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
