import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { pool } from "./pool";
import { logger } from "../lib/logger";

// Идемпотентное применение схемы (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
// Вызывается при старте — на проде не нужен отдельный шаг db:init.
const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(here, "schema.sql");

export async function applySchema(): Promise<void> {
  const sql = readFileSync(schemaPath, "utf8");
  await pool.query(sql);
  logger.info("schema applied (idempotent)");
}
