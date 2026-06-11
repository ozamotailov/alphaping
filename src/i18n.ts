// Локализация текстов бота. По умолчанию английский; русский — если язык юзера ru.
export type Lang = "en" | "ru";

export function pickLang(code?: string | null): Lang {
  return code && code.toLowerCase().startsWith("ru") ? "ru" : "en";
}

const en = {
  // алерты
  swap_trade_title: "Tracked wallet trade",
  swap_bought: "🟢 bought <b>{sym}</b> for {ton} TON",
  swap_sold: "🔴 sold <b>{sym}</b> for {ton} TON",
  swap_generic: "swap",
  transfer_title: "Jetton transfer",
  transfer_body: "moved tokens",
  ton_transfer: "TON transfer",
  listing_title: "New jetton listing",
  listing_dyor: "DYOR: check liquidity/lock before entering.",
  buy_button: "🟢 Buy on STON.fi",
  // команды
  open_app: "🛰️ Open TonSonar",
  get_pro: "⭐ Get Pro",
  start: "Hi! <b>TonSonar</b> tracks TON wallets and smart money right in Telegram.\n\n• Portfolio & PnL for your wallet\n• Real-time trade alerts for tracked wallets\n• New jetton listings on STON.fi\n\nOpen the app and add your first wallet 👇",
  pro_pitch: "<b>TonSonar Pro</b> — 500⭐/mo:\n50 wallets · real-time · curated smart-money lists · no ads.",
  status: "Plan: <b>{tier}</b>",
  help: "<b>TonSonar</b> — smart-money & TON wallet alerts.\n\n<b>How to use:</b>\n1. Open the app (menu button left of the input field).\n2. Connect a TON wallet → see portfolio & PnL.\n3. Add wallets to tracking — get trade alerts.\n4. Watch the new jetton listings feed.\n\n<b>Pro</b> (/pro): 50 wallets, real-time alerts, curated smart-money lists, no ads.\n\n🔒 Read-only addresses only — we never ask for private keys.",
  // платежи
  pay_success: "✅ {plan} activated!\nReal-time alerts and smart-money lists are on. Manage it in the Mini App settings.",
  precheckout_fail: "Couldn't process the payment, please try again.",
  plan_pro: "Pro / month",
  plan_whale: "Whale / month",
} as const;

type Key = keyof typeof en;

const ru: Record<Key, string> = {
  swap_trade_title: "Сделка отслеживаемого кошелька",
  swap_bought: "🟢 купил <b>{sym}</b> на {ton} TON",
  swap_sold: "🔴 продал <b>{sym}</b> за {ton} TON",
  swap_generic: "своп",
  transfer_title: "Jetton-перевод",
  transfer_body: "переместил токены",
  ton_transfer: "TON-перевод",
  listing_title: "Новый jetton-листинг",
  listing_dyor: "DYOR: проверьте ликвидность/лок перед входом.",
  buy_button: "🟢 Купить на STON.fi",
  open_app: "🛰️ Открыть TonSonar",
  get_pro: "⭐ Оформить Pro",
  start: "Привет! <b>TonSonar</b> следит за TON-кошельками и «умными деньгами» прямо в Telegram.\n\n• Портфель и PnL по твоему кошельку\n• Реал-тайм алерты сделок отслеживаемых кошельков\n• Новые jetton-листинги на STON.fi\n\nОткрой приложение и добавь первый кошелёк 👇",
  pro_pitch: "<b>TonSonar Pro</b> — 500⭐/мес:\n50 кошельков · реал-тайм · кураторские smart-money списки · без рекламы.",
  status: "Тариф: <b>{tier}</b>",
  help: "<b>TonSonar</b> — алерты по smart-money и кошелькам TON.\n\n<b>Как пользоваться:</b>\n1. Открой приложение (кнопка меню слева от поля ввода).\n2. Подключи TON-кошелёк → увидишь портфель и PnL.\n3. Добавляй кошельки в отслеживание — будут алерты их сделок.\n4. Смотри ленту новых jetton-листингов.\n\n<b>Pro</b> (/pro): 50 кошельков, реал-тайм алерты, кураторские smart-money списки, без рекламы.\n\n🔒 Только read-only адреса — приватные ключи мы никогда не запрашиваем.",
  pay_success: "✅ {plan} активирован!\nРеал-тайм алерты и smart-money списки включены. Управление — в настройках Mini App.",
  precheckout_fail: "Не удалось обработать платёж, попробуйте ещё раз.",
  plan_pro: "Pro / месяц",
  plan_whale: "Whale / месяц",
};

const dict: Record<Lang, Record<Key, string>> = { en, ru };

export function t(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  let s: string = dict[lang][key] ?? en[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
}
