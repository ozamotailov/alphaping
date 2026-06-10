# AlphaPing — фронтенд Mini App

Минимальный TWA на **React + Vite + `@tonconnect/ui-react`**, использующий официальный
`telegram-web-app.js` (`window.Telegram.WebApp`). Реализует сквозной сценарий:
профиль/тариф → TON Connect → watchlist с лимитами → покупка Pro через `openInvoice`.

## Запуск

```bash
cd webapp
npm install
cp .env.example .env          # VITE_API_URL=http://localhost:3000 (адрес бэкенда)
npm run dev                   # http://localhost:5173
```

> ⚠️ Вне Telegram `WebApp.initData` пустой → API вернёт 401. Для реального теста
> откройте приложение из бота (Web App URL в @BotFather указывает на этот фронт по HTTPS;
> на локали прокиньте туннелем). Для отладки UI без бэкенда можно временно замокать `api.ts`.

Ниже — ключевые точки интеграции (они уже реализованы в `src/`).

## 1. Авторизация запросов

Все запросы к API подписывайте заголовком `X-Telegram-Init-Data` со значением
`window.Telegram.WebApp.initData` — бэкенд валидирует его в `src/api/auth.ts`.

```ts
const res = await fetch(`${API}/api/me`, {
  headers: { "X-Telegram-Init-Data": window.Telegram.WebApp.initData },
});
```

## 2. Оплата Pro через Stars (внутри Mini App)

```ts
import { openInvoice } from "@telegram-apps/sdk";

async function buyPro() {
  const { link } = await fetch(`${API}/api/invoice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": window.Telegram.WebApp.initData,
    },
    body: JSON.stringify({ plan: "pro" }),
  }).then((r) => r.json());

  openInvoice(link, (status) => {
    // status: 'paid' | 'cancelled' | 'failed'
    if (status === "paid") refreshAccess();
  });
}
```

## 3. TON Connect

Положите `tonconnect-manifest.json` (пример рядом) на HTTPS-домен фронтенда и
укажите его URL при инициализации:

```ts
import { TonConnectUI } from "@tonconnect/ui";
const tc = new TonConnectUI({ manifestUrl: "https://app.alphaping.xyz/tonconnect-manifest.json" });

const wallet = await tc.connectWallet(); // только read-only адрес, без ключей
await fetch(`${API}/api/ton-address`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Telegram-Init-Data": window.Telegram.WebApp.initData,
  },
  body: JSON.stringify({ address: wallet.account.address }),
});
```

## 4. Экраны (MVP)

Онбординг → Портфель/PnL → Watchlist → Smart-money (🔒) → New Launches → Alerts → Settings.
