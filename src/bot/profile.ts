import { Bot } from "grammy";
import { config } from "../config";
import { logger } from "../lib/logger";

const SHORT_DESC =
  "Алерты по smart-money и TON-кошелькам: сделки, новые jetton-листинги, портфель и PnL.";

const DESCRIPTION =
  "TonSonar следит за TON-кошельками и «умными деньгами» прямо в Telegram.\n\n" +
  "• Портфель и PnL по твоему кошельку\n" +
  "• Реал-тайм алерты сделок отслеживаемых кошельков\n" +
  "• Новые jetton-листинги на STON.fi с проверкой на скам\n" +
  "• Кураторские списки smart-money (Pro)\n\n" +
  "Открой приложение и добавь первый кошелёк 👇";

/**
 * Программный полиш профиля бота при старте (идемпотентно): имя, описания, меню команд,
 * Menu Button → Web App. Заменяет ручные шаги в @BotFather (кроме аватара — его ставит BotFather).
 * Все вызовы обёрнуты: возможный rate-limit Telegram не должен валить запуск.
 */
export async function configureBotProfile(bot: Bot): Promise<void> {
  try {
    await bot.api.setMyName("TonSonar");
    await bot.api.setMyShortDescription(SHORT_DESC);
    await bot.api.setMyDescription(DESCRIPTION);
    await bot.api.setMyCommands([
      { command: "start", description: "Запуск и открыть приложение" },
      { command: "pro", description: "Оформить Pro-подписку" },
      { command: "status", description: "Мой тариф" },
      { command: "help", description: "Как пользоваться" },
    ]);
    await bot.api.setChatMenuButton({
      menu_button: { type: "web_app", text: "TonSonar", web_app: { url: config.WEBAPP_URL } },
    });
    logger.info("bot profile configured (name/desc/commands/menu)");
  } catch (e) {
    logger.warn("configureBotProfile failed (возможно rate-limit Telegram): " + String(e));
  }
}
