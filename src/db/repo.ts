import { pool } from "./pool";
import { normalizeAddress } from "../lib/ton";
import { SMART_LIST_NAME } from "../constants";

export interface UserRow {
  tg_id: number;
  tier: string;
  pro_expires_at: number | null;
  ton_address: string | null;
  follows_smartmoney: boolean;
}

// Слой доступа к данным. Сознательно тонкий — сырой SQL, без ORM.
export class Repo {
  async upsertUser(tgId: number): Promise<void> {
    await pool.query(
      `INSERT INTO users (tg_id) VALUES ($1)
       ON CONFLICT (tg_id) DO NOTHING`,
      [tgId],
    );
  }

  async getUser(tgId: number): Promise<UserRow | null> {
    const { rows } = await pool.query<UserRow>(
      `SELECT tg_id, tier, pro_expires_at, ton_address, follows_smartmoney
       FROM users WHERE tg_id = $1`,
      [tgId],
    );
    return rows[0] ?? null;
  }

  async setFollowSmartMoney(tgId: number, on: boolean): Promise<void> {
    await pool.query(`UPDATE users SET follows_smartmoney = $2 WHERE tg_id = $1`, [tgId, on]);
  }

  async setTonAddress(tgId: number, raw: string): Promise<void> {
    await pool.query(`UPDATE users SET ton_address = $2 WHERE tg_id = $1`, [tgId, raw]);
  }

  // --- Подписки / платежи ---
  async activateSubscription(p: {
    tgId: number;
    plan: string;
    chargeId: string;
    expiresAt: number | null;
    isRecurring: boolean;
    amountStars: number;
    period?: number;
  }): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE users SET tier = $2, pro_expires_at = $3, charge_id = $4 WHERE tg_id = $1`,
        [p.tgId, p.plan, p.expiresAt, p.chargeId],
      );
      await client.query(
        `INSERT INTO payments (user_id, charge_id, amount_stars, period, is_recurring)
         VALUES ($1, $2, $3, $4, $5)`,
        [p.tgId, p.chargeId, p.amountStars, p.period ?? null, p.isRecurring],
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async downgradeExpired(): Promise<void> {
    await pool.query(
      `UPDATE users SET tier = 'free'
       WHERE tier <> 'free' AND pro_expires_at IS NOT NULL
         AND pro_expires_at < EXTRACT(EPOCH FROM now())`,
    );
  }

  // --- Watchlist ---
  async addWatch(
    tgId: number,
    addr: { raw: string; friendly: string },
    label?: string,
  ): Promise<{ walletId: number; limited: boolean }> {
    // Проверка лимита по тарифу
    const user = await this.getUser(tgId);
    const limit = user?.tier === "whale" ? 100000 : user?.tier === "pro" ? 50 : 3;
    const { rows: cnt } = await pool.query<{ n: string }>(
      `SELECT count(*)::int AS n FROM watches WHERE user_id = $1`,
      [tgId],
    );
    if (Number(cnt[0]?.n ?? 0) >= limit) return { walletId: -1, limited: true };

    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO wallets (address_raw, address_friendly, label)
       VALUES ($1, $2, $3)
       ON CONFLICT (address_raw) DO UPDATE SET address_friendly = EXCLUDED.address_friendly
       RETURNING id`,
      [addr.raw, addr.friendly, label ?? null],
    );
    const walletId = rows[0]!.id;
    await pool.query(
      `INSERT INTO watches (user_id, wallet_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [tgId, walletId],
    );
    return { walletId, limited: false };
  }

  async listWatches(tgId: number) {
    const { rows } = await pool.query(
      `SELECT w.id, w.address_friendly, w.label, w.is_smartmoney
       FROM watches t JOIN wallets w ON w.id = t.wallet_id
       WHERE t.user_id = $1 ORDER BY w.id`,
      [tgId],
    );
    return rows;
  }

  async removeWatch(tgId: number, walletId: number): Promise<void> {
    await pool.query(`DELETE FROM watches WHERE user_id = $1 AND wallet_id = $2`, [tgId, walletId]);
    // Саму строку wallets не удаляем: она может использоваться другими юзерами/smart-money списком.
  }

  // --- Ingest helpers ---
  // Все отслеживаемые адреса (для бэкфилл-поллера): watch-листы всех юзеров
  // + участники smart-money списка, если есть хотя бы один подписчик.
  async allTrackedAddresses(listName = SMART_LIST_NAME): Promise<{ raw: string }[]> {
    const { rows } = await pool.query<{ raw: string }>(
      `SELECT w.address_raw AS raw FROM wallets w JOIN watches t ON t.wallet_id = w.id
       UNION
       SELECT w.address_raw FROM wallets w
         JOIN smart_list_members m ON m.wallet_id = w.id
         JOIN smart_lists l ON l.id = m.list_id AND l.name = $1
         WHERE EXISTS (SELECT 1 FROM users u WHERE u.tier IN ('pro','whale') AND u.follows_smartmoney)`,
      [listName],
    );
    return rows;
  }

  async setLastLt(raw: string, lt: number): Promise<void> {
    await pool.query(`UPDATE wallets SET last_lt = $2 WHERE address_raw = $1`, [raw, lt]);
  }

  async getLastLt(raw: string): Promise<number> {
    const { rows } = await pool.query<{ last_lt: string }>(
      `SELECT last_lt FROM wallets WHERE address_raw = $1`,
      [raw],
    );
    return rows[0] ? Number(rows[0].last_lt) : 0;
  }

  // Адреса для реал-тайм SSE: watch-листы Pro/Whale + участники smart-money списка,
  // если есть хотя бы один Pro/Whale подписчик на список.
  async proTrackedAddresses(listName = SMART_LIST_NAME): Promise<{ raw: string }[]> {
    const { rows } = await pool.query<{ raw: string }>(
      `SELECT w.address_raw AS raw
         FROM wallets w
         JOIN watches t ON t.wallet_id = w.id
         JOIN users u ON u.tg_id = t.user_id
         WHERE u.tier IN ('pro','whale')
       UNION
       SELECT w.address_raw FROM wallets w
         JOIN smart_list_members m ON m.wallet_id = w.id
         JOIN smart_lists l ON l.id = m.list_id AND l.name = $1
         WHERE EXISTS (SELECT 1 FROM users u2 WHERE u2.tier IN ('pro','whale') AND u2.follows_smartmoney)`,
      [listName],
    );
    return rows;
  }

  // Получатели алерта по адресу: те, кто следит за ним напрямую (watch),
  // плюс Pro/Whale-подписчики smart-money, если адрес — текущий участник списка.
  async subscribersWatching(raw: string, listName = SMART_LIST_NAME) {
    const { rows } = await pool.query<{ tg_id: number; tier: string; filters: any }>(
      `SELECT u.tg_id, u.tier, t.filters
         FROM wallets w
         JOIN watches t ON t.wallet_id = w.id
         JOIN users u ON u.tg_id = t.user_id
         WHERE w.address_raw = $1
       UNION
       SELECT u.tg_id, u.tier, '{}'::jsonb AS filters
         FROM users u
         WHERE u.tier IN ('pro','whale') AND u.follows_smartmoney
           AND EXISTS (
             SELECT 1 FROM wallets w2
               JOIN smart_list_members m ON m.wallet_id = w2.id
               JOIN smart_lists l ON l.id = m.list_id AND l.name = $2
             WHERE w2.address_raw = $1)`,
      [raw, listName],
    );
    return rows;
  }

  // --- New listings ---
  async poolSeen(address: string): Promise<boolean> {
    const { rowCount } = await pool.query(`SELECT 1 FROM pools_seen WHERE address = $1`, [address]);
    return (rowCount ?? 0) > 0;
  }

  async markPoolSeen(p: { address: string; dex: string; token0?: string; token1?: string }): Promise<void> {
    await pool.query(
      `INSERT INTO pools_seen (address, dex, token0, token1)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [p.address, p.dex, p.token0 ?? null, p.token1 ?? null],
    );
  }

  async proAndWhaleSubscribers(): Promise<number[]> {
    const { rows } = await pool.query<{ tg_id: number }>(
      `SELECT tg_id FROM users WHERE tier IN ('pro', 'whale')`,
    );
    return rows.map((r) => r.tg_id);
  }

  // --- Jetton safety / smart-money ---
  async setJettonSafety(address: string, symbol: string | null, safety: unknown): Promise<void> {
    await pool.query(
      `INSERT INTO jettons (address, symbol, safety)
       VALUES ($1, $2, $3)
       ON CONFLICT (address) DO UPDATE SET symbol = EXCLUDED.symbol, safety = EXCLUDED.safety`,
      [address, symbol, JSON.stringify(safety)],
    );
  }

  /**
   * Полностью пересобирает кураторский список: upsert строки списка, очистка состава,
   * upsert кошельков (is_smartmoney = true) и вставка участников со скором.
   */
  async replaceSmartList(name: string, members: { address: string; score: number }[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const existing = await client.query<{ id: number }>(`SELECT id FROM smart_lists WHERE name = $1`, [name]);
      let listId = existing.rows[0]?.id;
      if (listId == null) {
        const ins = await client.query<{ id: number }>(
          `INSERT INTO smart_lists (name, tier_required, score_method)
           VALUES ($1, 'pro', 'roi_winrate') RETURNING id`,
          [name],
        );
        listId = ins.rows[0]!.id;
      }

      await client.query(`DELETE FROM smart_list_members WHERE list_id = $1`, [listId]);

      for (const m of members) {
        const norm = normalizeAddress(m.address);
        const friendly = norm?.friendly ?? m.address;
        const w = await client.query<{ id: number }>(
          `INSERT INTO wallets (address_raw, address_friendly, is_smartmoney)
           VALUES ($1, $2, true)
           ON CONFLICT (address_raw) DO UPDATE SET is_smartmoney = true
           RETURNING id`,
          [m.address, friendly],
        );
        await client.query(
          `INSERT INTO smart_list_members (list_id, wallet_id, score)
           VALUES ($1, $2, $3) ON CONFLICT (list_id, wallet_id) DO UPDATE SET score = EXCLUDED.score`,
          [listId, w.rows[0]!.id, m.score],
        );
      }

      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async getSmartListMembers(
    name: string,
    limit = 50,
  ): Promise<{ address_friendly: string; score: number }[]> {
    const { rows } = await pool.query<{ address_friendly: string; score: number }>(
      `SELECT w.address_friendly, m.score
       FROM smart_lists l
       JOIN smart_list_members m ON m.list_id = l.id
       JOIN wallets w ON w.id = m.wallet_id
       WHERE l.name = $1
       ORDER BY m.score DESC NULLS LAST
       LIMIT $2`,
      [name, limit],
    );
    return rows;
  }
}
