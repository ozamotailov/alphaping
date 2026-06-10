import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Pool } from "pg";

// Кросс-платформенная инициализация БД: применяет src/db/schema.sql через node-postgres.
// Не требует установленного psql и работает на Windows/macOS/Linux.
// DATABASE_URL берётся из .env (localhost:5432 → проброшенный порт контейнера).

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(here, "../src/db/schema.sql");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL не задан. Скопируйте .env.example в .env и заполните.");
  process.exit(1);
}

const sql = readFileSync(schemaPath, "utf8");
const pool = new Pool({ connectionString: url });

try {
  await pool.query(sql); // несколько стейтментов в одном запросе — ок (simple query protocol)
  console.log("✅ Схема применена:", schemaPath);
} catch (e) {
  console.error("❌ Ошибка применения схемы:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
