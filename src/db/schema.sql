-- AlphaPing (TON-first) — схема Postgres.
-- Применить:  psql "$DATABASE_URL" -f src/db/schema.sql   (или npm run db:init)

CREATE TABLE IF NOT EXISTS users (
  tg_id          BIGINT PRIMARY KEY,
  tier           TEXT NOT NULL DEFAULT 'free',          -- free | pro | whale
  pro_expires_at BIGINT,                                 -- unix, дата следующего списания
  charge_id      TEXT,                                   -- telegram_payment_charge_id (для refund/cancel)
  ton_address    TEXT,                                   -- подключённый через TON Connect кошелёк (raw)
  follows_smartmoney BOOLEAN NOT NULL DEFAULT false,     -- подписан на кураторский smart-money список
  settings       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- На случай обновления существующей БД (CREATE TABLE IF NOT EXISTS не добавляет колонки):
ALTER TABLE users ADD COLUMN IF NOT EXISTS follows_smartmoney BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS wallets (
  id               BIGSERIAL PRIMARY KEY,
  address_raw      TEXT NOT NULL UNIQUE,                 -- 0:...  (ключ дедупа)
  address_friendly TEXT NOT NULL,
  label            TEXT,
  is_smartmoney    BOOLEAN NOT NULL DEFAULT false,
  last_lt          BIGINT NOT NULL DEFAULT 0             -- logical time последнего обработанного события
);

CREATE TABLE IF NOT EXISTS watches (
  user_id   BIGINT NOT NULL REFERENCES users(tg_id) ON DELETE CASCADE,
  wallet_id BIGINT NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  filters   JSONB NOT NULL DEFAULT '{}',                -- {minUsd, jettons[], ...}
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, wallet_id)
);

CREATE TABLE IF NOT EXISTS smart_lists (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  tier_required TEXT NOT NULL DEFAULT 'pro',
  score_method  TEXT
);

CREATE TABLE IF NOT EXISTS smart_list_members (
  list_id   BIGINT NOT NULL REFERENCES smart_lists(id) ON DELETE CASCADE,
  wallet_id BIGINT NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  score     NUMERIC,
  PRIMARY KEY (list_id, wallet_id)
);

CREATE TABLE IF NOT EXISTS jettons (
  address    TEXT PRIMARY KEY,
  symbol     TEXT,
  decimals   INT,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  safety     JSONB NOT NULL DEFAULT '{}'                -- {liquidityUsd, lpLocked, holders, risk}
);

CREATE TABLE IF NOT EXISTS pools_seen (
  address    TEXT PRIMARY KEY,
  dex        TEXT NOT NULL,                             -- stonfi | dedust
  token0     TEXT,
  token1     TEXT,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id        BIGSERIAL PRIMARY KEY,
  wallet_id BIGINT REFERENCES wallets(id) ON DELETE CASCADE,
  kind      TEXT NOT NULL,                              -- swap | transfer | ton
  jetton    TEXT,
  amount    NUMERIC,
  usd       NUMERIC,
  tx_hash   TEXT,
  lt        BIGINT,
  ts        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_wallet_ts ON events (wallet_id, ts DESC);

CREATE TABLE IF NOT EXISTS positions (
  user_id        BIGINT NOT NULL REFERENCES users(tg_id) ON DELETE CASCADE,
  jetton         TEXT NOT NULL,
  qty            NUMERIC NOT NULL DEFAULT 0,
  cost_basis_usd NUMERIC NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, jetton)
);

CREATE TABLE IF NOT EXISTS payments (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(tg_id) ON DELETE CASCADE,
  charge_id    TEXT NOT NULL,
  amount_stars INT NOT NULL,
  period       INT,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  ts           TIMESTAMPTZ NOT NULL DEFAULT now()
);
