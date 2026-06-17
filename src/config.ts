import "dotenv/config";
import { z } from "zod";

// Единая точка валидации окружения. Падаем на старте, если чего-то не хватает.
const schema = z.object({
  BOT_TOKEN: z.string().min(10, "BOT_TOKEN обязателен"),
  WEBAPP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  TONAPI_KEY: z.string().optional().default(""),
  PORT: z.coerce.number().default(3000),
  PUBLIC_API_URL: z.string().url().optional(),
  ADMIN_ID: z.coerce.number().default(0),
  // Публичный Telegram-канал (полный URL https://t.me/...). Если задан — в /start появится кнопка.
  CHANNEL_URL: z.string().optional(),
  // Постинг тизер-алертов В канал. @username или числовой id чата, где бот — админ.
  // Если не задан — авто-постинг выключен (no-op).
  CHANNEL_CHAT_ID: z.string().optional(),
  // Порог по размеру smart-money покупки (TON), ниже которого в канал не постим.
  CHANNEL_MIN_TON: z.coerce.number().default(50),
  // Листинги: минимальная ликвидность пула для алерта и анти-флуд лимит новых за цикл.
  MIN_LIQUIDITY_USD: z.coerce.number().default(1000),
  MAX_NEW_PER_CYCLE: z.coerce.number().default(30),
  // Окно переоценки нового пула (часы): держим под наблюдением и алертим, когда он
  // перерастает порог ликвидности; по истечении окна перестаём ждать.
  LISTING_WINDOW_HOURS: z.coerce.number().default(48),
  // Не слать TON-переводы (kind=ton) меньше этого размера (TON) — режет спам «0 TON»
  // при follow smart-money (служебные/dust-сообщения).
  MIN_TON_TRANSFER: z.coerce.number().default(1),
});

export const config = schema.parse(process.env);
export type Config = z.infer<typeof schema>;
