import { getJson } from "./tonapiClient";
import { logger } from "../lib/logger";

export type Risk = "low" | "medium" | "high";

export interface Safety {
  risk: Risk;
  badge: string; // 🟢 | 🟡 | 🔴
  address: string;
  symbol: string | null;
  liquidityUsd: number | null;
  holders: number | null;
  mintable: boolean | null;
  topHolderPct: number | null;
  reasons: string[];
}

const order: Record<Risk, number> = { low: 0, medium: 1, high: 2 };
const worse = (a: Risk, b: Risk): Risk => (order[b] > order[a] ? b : a);
const badgeOf = (r: Risk): string => (r === "low" ? "🟢" : r === "medium" ? "🟡" : "🔴");

interface JettonInfo {
  mintable?: boolean;
  total_supply?: string;
  holders_count?: number;
  verification?: string; // "whitelist" | "blacklist" | "none"
  metadata?: { symbol?: string; decimals?: string };
}
interface Holders {
  addresses?: { address: string; balance: string }[];
}

/**
 * Оценка риска нового jetton перед публикацией листинга. Это анти-скам фильтр:
 * mintable, концентрация у топ-холдера, число холдеров, ликвидность пула.
 * Поля jetton-эндпоинтов сверьте с tonapi (docs.tonconsole.com), пула — с docs.ston.fi.
 */
export async function checkJettonSafety(jetton: string, pool?: any): Promise<Safety> {
  const reasons: string[] = [];
  let risk: Risk = "low";
  let symbol: string | null = null;
  let holders: number | null = null;
  let mintable: boolean | null = null;
  let topHolderPct: number | null = null;

  try {
    const info = await getJson<JettonInfo>(`/jettons/${jetton}`);
    symbol = info.metadata?.symbol ?? null;
    mintable = info.mintable ?? null;
    holders = info.holders_count ?? null;

    if (mintable) {
      reasons.push("Mint not disabled (mintable)");
      risk = worse(risk, "high");
    }
    if (info.verification === "blacklist") {
      reasons.push("Blacklisted on tonapi");
      risk = worse(risk, "high");
    }
    if (holders != null && holders < 30) {
      reasons.push(`Few holders: ${holders}`);
      risk = worse(risk, "medium");
    }

    const supply = Number(info.total_supply ?? 0);
    if (supply > 0) {
      const hs = await getJson<Holders>(`/jettons/${jetton}/holders?limit=10`);
      const top = hs.addresses?.[0]?.balance;
      if (top) {
        topHolderPct = (Number(top) / supply) * 100;
        if (topHolderPct > 50) {
          reasons.push(`Top holder owns ${topHolderPct.toFixed(0)}%`);
          risk = worse(risk, "high");
        } else if (topHolderPct > 25) {
          reasons.push(`Top holder ${topHolderPct.toFixed(0)}%`);
          risk = worse(risk, "medium");
        }
      }
    }
  } catch (e) {
    logger.warn("safety: jetton fetch failed", { jetton, e: String(e) });
    reasons.push("Couldn't verify jetton");
    risk = worse(risk, "medium");
  }

  // Ликвидность из пула STON.fi (поле tvl часто недоступно — тогда null, без штрафа).
  const liquidityUsd = numOrNull(pool?.tvl_usd ?? pool?.lp_total_supply_usd);
  if (liquidityUsd != null && liquidityUsd < 1000) {
    reasons.push(`Low liquidity ~$${liquidityUsd.toFixed(0)}`);
    risk = worse(risk, "medium");
  }

  return { risk, badge: badgeOf(risk), address: jetton, symbol, liquidityUsd, holders, mintable, topHolderPct, reasons };
}

function numOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
