import { Bot } from "grammy";
import { config } from "../config";
import { Repo } from "../db/repo";
import { registerCommands } from "./commands";
import { registerPayments } from "./payments";

// Собирает экземпляр бота со всеми обработчиками (без запуска long-polling/webhook).
export function buildBot(repo: Repo): Bot {
  const bot = new Bot(config.BOT_TOKEN);
  registerCommands(bot, repo);
  registerPayments(bot, repo);
  return bot;
}
