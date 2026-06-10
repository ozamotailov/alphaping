import { getJson, getTonUsd } from "./tonapiClient";
import { scoreWallet } from "./smartmoney";

interface JettonBalance {
  balance: string;
  price?: { prices?: { USD?: number } };
  jetton: {
    address: string;
    name?: string;
    symbol?: string;
    decimals: number;
    image?: string;
    verification?: string; // "whitelist" | "none" | "blacklist"
  };
}

export interface Holding {
  symbol: string;
  name: string;
  qty: number;
  usd: number;
  image?: string;
  verified: boolean;
}

export interface Portfolio {
  address: string;
  totalUsd: number;
  ton: { qty: number; usd: number };
  holdings: Holding[];
  realizedPnl30d: number;
  trades: number;
  winRate: number;
}

/**
 * Портфель TON-адреса: баланс TON + jetton-холдинги в USD (цены из tonapi),
 * плюс реализованный PnL за 30д (переиспользуем scoreWallet). Только read-only данные.
 */
export async function getPortfolio(address: string, topN = 20): Promise<Portfolio> {
  const tonUsd = await getTonUsd();

  // Баланс TON
  const acc = await getJson<{ balance?: string | number }>(`/accounts/${address}`);
  const tonQty = Number(acc.balance ?? 0) / 1e9;
  const tonUsdVal = tonQty * tonUsd;

  // Jetton-балансы с ценой
  const jb = await getJson<{ balances?: JettonBalance[] }>(
    `/accounts/${address}/jettons?currencies=usd`,
  );

  const holdings: Holding[] = [];
  for (const b of jb.balances ?? []) {
    const dec = b.jetton.decimals ?? 9;
    const qty = Number(b.balance) / 10 ** dec;
    if (!(qty > 0)) continue;
    const price = b.price?.prices?.USD ?? 0;
    const usd = qty * price;
    if (!(usd > 0)) continue; // без цены/ценности — пропускаем (пыль и скам без ликвидности)
    holdings.push({
      symbol: b.jetton.symbol ?? "?",
      name: b.jetton.name ?? "",
      qty,
      usd,
      image: b.jetton.image,
      verified: b.jetton.verification === "whitelist",
    });
  }
  holdings.sort((a, b) => b.usd - a.usd);

  const jettonUsd = holdings.reduce((s, h) => s + h.usd, 0);
  const totalUsd = tonUsdVal + jettonUsd;

  // Реализованный PnL за 30 дней (best-effort).
  let realizedPnl30d = 0;
  let trades = 0;
  let winRate = 0;
  try {
    const sc = await scoreWallet(address, 30);
    realizedPnl30d = sc.realizedUsd;
    trades = sc.trades;
    winRate = sc.winRate;
  } catch {
    /* PnL опционален — портфель важнее */
  }

  return {
    address,
    totalUsd,
    ton: { qty: tonQty, usd: tonUsdVal },
    holdings: holdings.slice(0, topN),
    realizedPnl30d,
    trades,
    winRate,
  };
}
