# 🛰️ TonSonar — TON-first smart-money & wallet alerts

Telegram Mini App + бот: алерты по TON-кошелькам и smart-money, портфель/PnL,
новые jetton-листинги. Монетизация — Telegram Stars (подписка) с выводом в TON.

**▶ [Demo video](https://youtu.be/RHRY2dgy8A8?is=8rePt7aR8aQzWz3q) · 📄 [One-pager](ONEPAGER.md) · 🤖 [Try the bot](https://t.me/tonsonar_bot) · 🛰️ [Live Mini App](https://alphaping-production.up.railway.app) · 📨 [Grant proposal](GRANT.md)**

Live, deployed 24/7 · open-source · bilingual EN/RU · read-only (never asks for private keys).
Frontend Mini App: [`webapp/`](webapp/README.md).

## Что внутри

```
src/
├── index.ts              # точка входа: бот + API + воркер + ingest
├── config.ts             # валидация .env (zod)
├── bot/
│   ├── bot.ts            # сборка экземпляра grammY
│   ├── commands.ts       # /start /pro /status /refund
│   └── payments.ts       # ★ Stars: инвойс, подписка, pre_checkout, successful_payment, refund/cancel
├── api/
│   ├── server.ts         # Express API для Mini App (/api/invoice, /api/watch, ...)
│   └── auth.ts           # ★ валидация Telegram WebApp initData (HMAC)
├── ingest/
│   ├── tonapiClient.ts   # низкоуровневый клиент tonapi (REST + SSE-стрим)
│   ├── tonapi.ts         # processAccount (дедуп по lt) + бэкфилл-поллер
│   ├── tonapiStream.ts   # ★ реал-тайм SSE по Pro/Whale адресам (реконнект, чанки)
│   ├── safety.ts         # ★ анти-скам проверка нового jetton (mintable/холдеры/ликвидность)
│   ├── smartmoney.ts     # ★ скоринг кошельков по ROI/win-rate → кураторские списки
│   └── stonfi.ts         # детект новых jetton-листингов (diff пулов + safety)
├── alerts/
│   ├── queue.ts          # очередь BullMQ
│   ├── deliver.ts        # рассылка подписчикам (free — с задержкой, pro/whale — сразу)
│   └── format.ts         # форматирование сообщений
├── db/
│   ├── schema.sql        # схема Postgres
│   ├── pool.ts           # pg pool
│   └── repo.ts           # слой доступа к данным
└── lib/
    ├── ton.ts            # нормализация TON-адресов (@ton/core)
    └── logger.ts
```

## Быстрый старт

```bash
# 1) инфраструктура (Postgres + Redis)
docker compose up -d

# 2) зависимости и конфиг
npm install
cp .env.example .env        # впишите BOT_TOKEN и WEBAPP_URL

# 3) схема БД
npm run db:init

# 4) запуск (dev, hot-reload)
npm run dev
```

Бот поднимется на long polling, API — на `http://localhost:3000`.
Для Mini App нужен HTTPS-домен фронтенда (задаётся в @BotFather как Web App URL);
на локали удобно прокинуть туннелем.

## Платёжный цикл Stars (центральная часть)

1. Фронт зовёт `POST /api/invoice {plan:"pro"}` → бэк отдаёт `link` (`createInvoiceLink`,
   `currency:"XTR"`, `subscription_period:2592000`).
2. Фронт открывает `WebApp.openInvoice(link)`.
3. Бот ловит `pre_checkout_query` → `answerPreCheckoutQuery(true)` (в течение 10 с).
4. Бот ловит `message:successful_payment` → `repo.activateSubscription(...)` (работает и на авто-продлении).
5. Возврат/отмена: `refundStarPayment` / `editUserStarSubscription`.

Параметры Stars→TON (курс ~$0.009–0.011/⭐, мин. 1000⭐, холд 21 день, вывод через Fragment)
вынесены в продуктовую документацию, в коде не зашиты.

## ⚠️ Сверьте перед боем

- **Сигнатуры Bot API/grammy** (`createInvoiceLink`, `subscription_period`,
  `editUserStarSubscription`, поля `successful_payment`) — между версиями менялись.
- **Поля tonapi** (`actions[].JettonSwap/...`) — по `openapi.yml` репо `tonkeeper/opentonapi`.
- **Поля STON.fi** (`/v1/pools`) — по `docs.ston.fi`.
- **Safety-проверка листингов** (`stonfi.ts`, TODO) — без неё не публикуйте сырые запуски: станете усилителем скама.
- **Read-only**: нигде не запрашивайте приватные ключи/seed — только адреса.

## Дорожная карта (из спека)

- [x] Stars-подписка + цикл платежей
- [x] initData-аутентификация, watchlist, лимиты по тарифу
- [x] Поллинг событий TON + новые листинги
- [x] Реал-тайм через tonapi SSE (Pro/Whale)
- [x] Анти-скам safety-проверка листингов (skip risk=high)
- [x] Скоринг smart-money по ROI/win-rate (`rebuildSmartList`)
- [x] Автоподбор кандидатов из активных свопперов STON.fi (`discovery.ts`, авто каждые 6ч + `/rebuildsm`)
- [x] Follow-list: Pro подписывается на smart-money → ingest покрывает участников → алерты (без траты лимита watch)
- [x] Smart-money на фронте (`/api/smart-money` + секция с тоглом «Отслеживать»)
- [ ] PnL/портфель, DeFi-позиции/IL (Whale)
- [ ] DeDust, фарминг/airdrop-борд

### Движок алертов (ingest)

`tonapiStream` держит SSE-соединения по Pro/Whale адресам и на каждое событие дёргает
`processAccount` (идемпотентно, дедуп по `lt`); `startPolling` — бэкфилл-подстраховка.
Новые листинги из `stonfi` проходят `checkJettonSafety` и публикуются только при `risk != high`.
Кураторские списки строит `rebuildSmartList(repo, name, candidates[])` — на вход подаётся список
адресов-кандидатов (их сбор из активных свопперов пулов — следующий шаг).
```
