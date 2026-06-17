import { tg } from "./telegram";

type Lang = "en" | "ru";

// Приоритет языка: ?lang= в URL (форс, для записи/deep-link) > сохранённый в localStorage
// (выбор пользователя) > язык Telegram. По умолчанию английский.
const urlOverride: Lang | null = (() => {
  const q = new URLSearchParams(window.location.search).get("lang");
  return q === "en" || q === "ru" ? q : null;
})();

function fromCode(code?: string | null): Lang {
  return code && code.toLowerCase().startsWith("ru") ? "ru" : "en";
}

function storedLang(): Lang | null {
  try {
    const v = localStorage.getItem("ts_lang");
    return v === "en" || v === "ru" ? v : null;
  } catch {
    return null;
  }
}

let currentLang: Lang = urlOverride ?? storedLang() ?? fromCode(tg?.initDataUnsafe?.user?.language_code);

/**
 * Применить предпочтение языка (например, серверное из /api/me или выбор /lang).
 * URL-форс имеет приоритет и не перебивается. Возвращает true, если язык изменился
 * (тогда вызывающий должен перерендерить UI).
 */
export function setLang(code?: string | null): boolean {
  if (urlOverride || !code) return false;
  const next = fromCode(code);
  if (next === currentLang) return false;
  currentLang = next;
  try {
    localStorage.setItem("ts_lang", next);
  } catch {
    /* ignore */
  }
  return true;
}

const en = {
  err_initData: "Open the app from Telegram (no initData).",
  err_generic: "Error",
  err_limit: "Free wallet limit reached. Upgrade to Pro 👇",
  err_sm_pro: "Smart-money lists are Pro-only.",
  err_connect_wallet: "Connect a TON wallet",
  err_swap_failed: "Swap cancelled or failed.",
  err_payment_failed: "Payment failed. Please try again.",
  swap_title: "Buy {sym} on STON.fi",
  close: "Close",
  swap_amount_ph: "How much TON",
  quoting: "Getting rate…",
  swap_receive: "You get ≈ {qty} {sym} · impact {x}%",
  swap_enter_amount: "Enter TON amount",
  swap_btn: "Swap via TON Connect",
  swap_btn_noconnect: "Connect a wallet first",
  tier: "Plan",
  wallets_count: "Wallets: {n} / {limit}",
  connect_short: "Connect a TON wallet for portfolio & PnL",
  portfolio: "Portfolio",
  pnl_label: "PnL 30d",
  no_holdings: "No priced jetton holdings.",
  connect_full: "Connect a TON wallet (button top-right) to see portfolio & PnL.",
  buy_more: "Buy more",
  watchlist: "Tracked wallets",
  addr_ph: "TON address (EQ.../UQ...)",
  add: "Add",
  watchlist_empty: "Empty — add your first address.",
  remove: "Remove",
  sm_title: "💡 Smart money",
  following: "✓ Following",
  follow: "+ Follow",
  sm_locked: "🔒 {n} smart-money wallets — available in Pro.",
  sm_building: "List is building automatically — check back later.",
  sm_following_note: "You get alerts on these wallets' trades in the bot.",
  copied: "Address copied ✓",
  copy_failed: "Couldn't copy",
  pro_title: "TonSonar Pro — 500⭐/mo",
  pro_b1: "50 wallets instead of 3",
  pro_b2: "Real-time alerts",
  pro_b3: "Curated smart-money lists",
  pro_b4: "New jetton listings",
  pro_btn: "⭐ Get Pro",
  footer: "Read-only addresses only. We never ask for private keys.",
} as const;

type Key = keyof typeof en;

const ru: Record<Key, string> = {
  err_initData: "Откройте приложение из Telegram (нет initData).",
  err_generic: "Ошибка",
  err_limit: "Достигнут лимит кошельков на Free. Оформите Pro 👇",
  err_sm_pro: "Smart-money списки доступны в Pro.",
  err_connect_wallet: "Подключите TON-кошелёк",
  err_swap_failed: "Своп отменён или не прошёл.",
  err_payment_failed: "Платёж не прошёл. Попробуйте ещё раз.",
  swap_title: "Купить {sym} на STON.fi",
  close: "Закрыть",
  swap_amount_ph: "Сколько TON",
  quoting: "Считаю курс…",
  swap_receive: "Получишь ≈ {qty} {sym} · импакт {x}%",
  swap_enter_amount: "Введите сумму TON",
  swap_btn: "Обменять через TON Connect",
  swap_btn_noconnect: "Сначала подключите кошелёк",
  tier: "Тариф",
  wallets_count: "Кошельков: {n} / {limit}",
  connect_short: "Подключите TON-кошелёк для портфеля и PnL",
  portfolio: "Портфель",
  pnl_label: "PnL 30д",
  no_holdings: "Нет jetton-холдингов с ценой.",
  connect_full: "Подключите TON-кошелёк (кнопка вверху справа), чтобы видеть портфель и PnL.",
  buy_more: "Купить ещё",
  watchlist: "Отслеживаемые кошельки",
  addr_ph: "TON-адрес (EQ.../UQ...)",
  add: "Добавить",
  watchlist_empty: "Пока пусто — добавьте первый адрес.",
  remove: "Удалить",
  sm_title: "💡 Smart-money",
  following: "✓ Отслеживается",
  follow: "+ Отслеживать",
  sm_locked: "🔒 {n} кошельков «умных денег» — доступно в Pro.",
  sm_building: "Список формируется автоматически — загляни позже.",
  sm_following_note: "Алерты по сделкам этих кошельков приходят в бот.",
  copied: "Адрес скопирован ✓",
  copy_failed: "Не удалось скопировать",
  pro_title: "TonSonar Pro — 500⭐/мес",
  pro_b1: "50 кошельков вместо 3",
  pro_b2: "Реал-тайм алерты",
  pro_b3: "Кураторские smart-money списки",
  pro_b4: "Новые jetton-листинги",
  pro_btn: "⭐ Оформить Pro",
  footer: "Только read-only адреса. Приватные ключи мы никогда не запрашиваем.",
};

const dict: Record<Lang, Record<Key, string>> = { en, ru };

export function t(key: Key, vars?: Record<string, string | number>): string {
  let s: string = dict[currentLang][key] ?? en[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
}
