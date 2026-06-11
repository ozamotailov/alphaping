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
  // Листинги: минимальная ликвидность пула для алерта и анти-флуд лимит новых за цикл.
  MIN_LIQUIDITY_USD: z.coerce.number().default(1000),
  MAX_NEW_PER_CYCLE: z.coerce.number().default(30),
});

export const config = schema.parse(process.env);
export type Config = z.infer<typeof schema>;
