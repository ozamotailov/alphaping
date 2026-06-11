import { shortAddr } from "../lib/ton";
import { t, type Lang } from "../i18n";

// Поля внутри data соответствуют декодированным действиям tonapi (JettonSwap и т.п.).

export function formatSwap(addr: string, data: any, lang: Lang = "en"): string {
  const dex = data?.dex ?? "DEX";
  const buy = data?.jetton_master_out && data?.ton_in;
  const sell = data?.jetton_master_in && data?.ton_out;
  let line = t(lang, "swap_generic");
  if (buy) {
    const sym = data.jetton_master_out?.symbol ?? "?";
    line = t(lang, "swap_bought", { sym, ton: (Number(data.ton_in) / 1e9).toFixed(2) });
  } else if (sell) {
    const sym = data.jetton_master_in?.symbol ?? "?";
    line = t(lang, "swap_sold", { sym, ton: (Number(data.ton_out) / 1e9).toFixed(2) });
  }
  return (
    `<b>${t(lang, "swap_trade_title")}</b> · ${dex}\n` +
    `<code>${shortAddr(addr)}</code>\n${line}\n` +
    `<a href="https://tonviewer.com/${addr}">tonviewer ↗</a>`
  );
}

export function formatTransfer(addr: string, _data: any, lang: Lang = "en"): string {
  return (
    `🔵 <b>${t(lang, "transfer_title")}</b>\n` +
    `<code>${shortAddr(addr)}</code> ${t(lang, "transfer_body")}\n` +
    `<a href="https://tonviewer.com/${addr}">tonviewer ↗</a>`
  );
}

export function formatTon(addr: string, data: any, lang: Lang = "en"): string {
  const amount = data?.amount ? Number(data.amount) / 1e9 : 0;
  return `🟡 <b>${t(lang, "ton_transfer")}</b>\n<code>${shortAddr(addr)}</code>: ${amount.toFixed(2)} TON`;
}

export function formatListing(pool: any, safety?: any, lang: Lang = "en"): string {
  const badge = safety?.badge ?? "⚪";
  // Если tonapi ещё не отдал метаданные нового токена — показываем короткий адрес, а не "?".
  const sym = safety?.symbol || (safety?.address ? shortHash(safety.address) : "?");
  const liq = safety?.liquidityUsd != null ? ` · liq ~$${Number(safety.liquidityUsd).toFixed(0)}` : "";
  const reasons: string[] = safety?.reasons ?? [];
  const reasonsBlock = reasons.length ? "\n" + reasons.map((r) => "• " + r).join("\n") : "";
  return (
    `🚀 <b>${t(lang, "listing_title")}</b> ${badge}\n` +
    `Token: <b>${sym}</b>${liq}\n` +
    `DEX: ${pool?.dex ?? "STON.fi"} · pool <code>${shortHash(pool?.address)}</code>${reasonsBlock}\n` +
    `⚠️ ${t(lang, "listing_dyor")}`
  );
}

function shortHash(s?: string): string {
  if (!s) return "?";
  return s.length > 12 ? s.slice(0, 6) + "…" + s.slice(-4) : s;
}
