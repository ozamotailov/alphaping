import { Bot } from "grammy";
import { config } from "../config";
import { logger } from "../lib/logger";

const SHORT_EN = "Smart-money & TON wallet alerts: trades, new jetton listings, portfolio & PnL.";
const SHORT_RU =
  "Алерты по smart-money и TON-кошелькам: сделки, новые jetton-листинги, портфель и PnL.";

const DESC_EN =
  "TonSonar tracks TON wallets and smart money right in Telegram.\n\n" +
  "• Portfolio & PnL for your wallet\n" +
  "• Real-time trade alerts for tracked wallets\n" +
  "• New jetton listings on STON.fi with a scam check\n" +
  "• Curated smart-money lists (Pro)\n\n" +
  "Open the app and add your first wallet 👇";

const DESC_RU =
  "TonSonar следит за TON-кошельками и «умными деньгами» прямо в Telegram.\n\n" +
  "• Портфель и PnL по твоему кошельку\n" +
  "• Реал-тайм алерты сделок отслеживаемых кошельков\n" +
  "• Новые jetton-листинги на STON.fi с проверкой на скам\n" +
  "• Кураторские списки smart-money (Pro)\n\n" +
  "Открой приложение и добавь первый кошелёк 👇";

const CMDS_EN = [
  { command: "start", description: "Start & open the app" },
  { command: "pro", description: "Get Pro subscription" },
  { command: "status", description: "My plan" },
  { command: "help", description: "How to use" },
];
const CMDS_RU = [
  { command: "start", description: "Запуск и открыть приложение" },
  { command: "pro", description: "Оформить Pro-подписку" },
  { command: "status", description: "Мой тариф" },
  { command: "help", description: "Как пользоваться" },
];

/**
 * Программный полиш профиля бота при старте (идемпотентно): имя, описания (EN по умолчанию + RU),
 * меню команд (EN + RU), Menu Button → Web App. Аватар ставится в @BotFather.
 */
export async function configureBotProfile(bot: Bot): Promise<void> {
  try {
    await bot.api.setMyName("TonSonar");
    await bot.api.setMyShortDescription(SHORT_EN);
    await bot.api.setMyShortDescription(SHORT_RU, { language_code: "ru" });
    await bot.api.setMyDescription(DESC_EN);
    await bot.api.setMyDescription(DESC_RU, { language_code: "ru" });
    await bot.api.setMyCommands(CMDS_EN);
    await bot.api.setMyCommands(CMDS_RU, { language_code: "ru" });
    await bot.api.setChatMenuButton({
      menu_button: { type: "web_app", text: "TonSonar", web_app: { url: config.WEBAPP_URL } },
    });
    logger.info("bot profile configured (name/desc/commands EN+RU/menu)");
  } catch (e) {
    logger.warn("configureBotProfile failed (возможно rate-limit Telegram): " + String(e));
  }
}
