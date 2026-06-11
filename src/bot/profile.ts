import { Bot } from "grammy";
import { config } from "../config";
import { logger } from "../lib/logger";

// Профиль бота — English-only, чтобы Telegram показывал английское описание ВСЕМ
// (он выбирает локаль по language_code пользователя, и для ru-юзеров без EN-only
// показал бы русское). Сами сообщения/алерты остаются двуязычными (см. i18n + /lang).
const SHORT = "Smart-money & TON wallet alerts: trades, new jetton listings, portfolio & PnL.";

const DESC =
  "TonSonar tracks TON wallets and smart money right in Telegram.\n\n" +
  "• Portfolio & PnL for your wallet\n" +
  "• Real-time trade alerts for tracked wallets\n" +
  "• New jetton listings on STON.fi with a scam check\n" +
  "• Curated smart-money lists (Pro)\n\n" +
  "Open the app and add your first wallet 👇";

const CMDS = [
  { command: "start", description: "Start & open the app" },
  { command: "pro", description: "Get Pro subscription" },
  { command: "status", description: "My plan" },
  { command: "lang", description: "Language (en/ru)" },
  { command: "help", description: "How to use" },
];

/**
 * Программный полиш профиля бота при старте (идемпотентно): имя, описание, меню команд,
 * Menu Button → Web App. English-only (см. коммент выше). Аватар ставится в @BotFather.
 */
// Каждый вызов независим: сбой одного (напр. rate-limit) не должен ломать остальные.
async function safe(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    logger.warn(`profile ${label} failed: ${String(e)}`);
  }
}

export async function configureBotProfile(bot: Bot): Promise<void> {
  await safe("name", () => bot.api.setMyName("TonSonar"));
  await safe("short", () => bot.api.setMyShortDescription(SHORT));
  await safe("desc", () => bot.api.setMyDescription(DESC));
  await safe("commands", () => bot.api.setMyCommands(CMDS));
  // Сбрасываем возможный прежний РУССКИЙ вариант профиля (иначе ru-юзеры видят его, а не EN-дефолт).
  await safe("short-ru-clear", () => bot.api.setMyShortDescription("", { language_code: "ru" }));
  await safe("desc-ru-clear", () => bot.api.setMyDescription("", { language_code: "ru" }));
  await safe("commands-ru", () => bot.api.setMyCommands(CMDS, { language_code: "ru" }));
  await safe("menu", () =>
    bot.api.setChatMenuButton({
      menu_button: { type: "web_app", text: "TonSonar", web_app: { url: config.WEBAPP_URL } },
    }),
  );
  logger.info("bot profile configured (English-only, per-call)");
}
