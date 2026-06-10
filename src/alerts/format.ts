import { shortAddr } from "../lib/ton";

// Форматирование сообщений-алертов (HTML parse_mode).
// Поля внутри data соответствуют декодированным действиям tonapi — сверьте с openapi.

export function formatSwap(addr: string, data: any): string {
  const dex = data?.dex ?? "DEX";
  const usd = data?.ton_usd ? ` (~$${Number(data.ton_usd).toFixed(0)})` : "";
  return (
    `🟢 <b>Сделка smart-money</b>\n` +
    `<code>${shortAddr(addr)}</code> своп на <b>${dex}</b>${usd}\n` +
    `<a href="https://tonviewer.com/${addr}">tonviewer ↗</a>`
  );
}

export function formatTransfer(addr: string, data: any): string {
  return (
    `🔵 <b>Jetton-перевод</b>\n` +
    `<code>${shortAddr(addr)}</code> переместил токены\n` +
    `<a href="https://tonviewer.com/${addr}">tonviewer ↗</a>`
  );
}

export function formatTon(addr: string, data: any): string {
  const amount = data?.amount ? Number(data.amount) / 1e9 : 0;
  return `🟡 <b>TON-перевод</b>\n<code>${shortAddr(addr)}</code>: ${amount.toFixed(2)} TON`;
}

export function formatListing(pool: any, safety?: any): string {
  const badge = safety?.badge ?? "⚪";
  const sym = safety?.symbol ?? "?";
  const liq = safety?.liquidityUsd != null ? ` · ликв. ~$${Number(safety.liquidityUsd).toFixed(0)}` : "";
  const reasons: string[] = safety?.reasons ?? [];
  const reasonsBlock = reasons.length ? "\n" + reasons.map((r) => "• " + r).join("\n") : "";
  return (
    `🚀 <b>Новый jetton-листинг</b> ${badge}\n` +
    `Токен: <b>${sym}</b>${liq}\n` +
    `DEX: ${pool?.dex ?? "STON.fi"} · пул <code>${shortHash(pool?.address)}</code>${reasonsBlock}\n` +
    `⚠️ DYOR: проверьте ликвидность/лок перед входом.`
  );
}

function shortHash(s?: string): string {
  if (!s) return "?";
  return s.length > 12 ? s.slice(0, 6) + "…" + s.slice(-4) : s;
}
