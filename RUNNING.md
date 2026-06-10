# Запуск AlphaPing на локальной машине

## Что запускаем
- **Бэкенд** (`alphaping/`): бот (long polling — самому боту туннель НЕ нужен) + API + ingest + воркер алертов.
- **Postgres + Redis** — через Docker.
- **Фронтенд** (`alphaping/webapp/`): Mini App. Для теста в Telegram нужен HTTPS-туннель.

Два режима:
- **Режим A — полный тест в Telegram** (один туннель). Рекомендуется.
- **Режим B — UI-отладка в браузере** (без оплаты; `initData` пустой).

---

## 1. Предустановки
```bash
node -v      # нужен Node.js 20+
docker -v    # Docker + docker compose (для Postgres/Redis)
```
Туннель: [ngrok](https://ngrok.com/download) или `cloudflared`. Аккаунт Telegram.

## 2. Создать бота
1. Открыть **@BotFather** → `/newbot` → задать имя и username → получить **BOT_TOKEN**.
2. Узнать свой Telegram id у **@userinfobot** (понадобится для `ADMIN_ID`).

## 3. Поднять Postgres + Redis
```bash
cd alphaping
docker compose up -d
docker compose ps        # оба контейнера должны быть Up
```

## 4. Бэкенд: зависимости, .env, схема
```bash
npm install
cp .env.example .env
```
Отредактировать `.env`:
- `BOT_TOKEN=` — из BotFather
- `WEBAPP_URL=http://localhost:5173` — временно; заменим на туннель в шаге 8
- `DATABASE_URL`, `REDIS_URL` — оставить (совпадают с docker-compose)
- `TONAPI_KEY=` — можно пусто; для стабильного SSE возьмите ключ на tonconsole.com
- `ADMIN_ID=` — ваш Telegram id

Применить схему БД:
```bash
npm run db:init
# если psql не установлен локально — через контейнер:
# cat src/db/schema.sql | docker compose exec -T postgres psql -U alphaping -d alphaping
```

## 5. Фронтенд: собрать (его раздаст бэкенд)
```bash
cd webapp
npm install
npm run build            # создаёт webapp/dist
cd ..
```

## 6. Запустить бэкенд
```bash
npm run dev
```
В логах ждём: `serving webapp from .../webapp/dist`, `API listening on :3000`, `bot @<username> started`.
Проверка: открыть в браузере `http://localhost:3000/health` → `{"ok":true}`.

## 7. HTTPS-туннель (в отдельном терминале)
```bash
ngrok http 3000
# или: cloudflared tunnel --url http://localhost:3000
```
Скопировать https-URL, например `https://abc123.ngrok-free.app`.

## 8. Привязать туннель
1. В `.env`: `WEBAPP_URL=https://abc123.ngrok-free.app` → перезапустить бэкенд (Ctrl+C, `npm run dev`).
2. (Рекомендуется) В `webapp/public/tonconnect-manifest.json` заменить `url`/`iconUrl` на туннель-URL → снова `npm run build`. Иначе TON Connect может ругаться на несовпадение.
3. В **@BotFather** → `/mybots` → ваш бот → **Bot Settings → Menu Button → Edit menu button URL** → вставить туннель-URL. (Либо пользоваться кнопкой из `/start`, она берёт `WEBAPP_URL`.)

## 9. Тест end-to-end в Telegram
1. Открыть бота → `/start` → нажать «🛰️ Открыть AlphaPing» (или Menu Button).
2. Mini App открывается, тариф `free`.
3. Подключить TON-кошелёк (Tonkeeper/Wallet) — адрес уйдёт на `/api/ton-address`.
4. Добавить TON-адрес в watchlist (на free лимит 3; 4-й → апселл Pro).
5. «⭐ Оформить Pro» → откроется инвойс Telegram Stars → оплатить → тариф станет `pro`, лимит 50.

> ⚠️ **Stars — реальные деньги.** Чтобы протестировать дёшево: временно поставьте в
> `src/bot/payments.ts` `PLANS.pro.stars = 1`, проведите оплату, затем верните звёзды:
> в логах события `successful_payment` возьмите `telegram_payment_charge_id` и выполните в боте
> `/refund <charge_id>` (вы должны быть `ADMIN_ID`). `refundStarPayment` возвращает звёзды полностью.

## 10. Проверить алерты
- Добавьте активный кошелёк — при его свопе/переводе бот пришлёт алерт (на Pro — реал-тайм через SSE, на free — с задержкой ~12 мин).
- Новые jetton-листинги STON.fi приходят Pro/Whale (high-risk отсеиваются safety-проверкой).
- Пустой `TONAPI_KEY` → возможны лимиты; для стабильного SSE добавьте ключ.

## 11. Режим B — UI-отладка в браузере (без Telegram)
```bash
# терминал 1
npm run dev                # бэкенд :3000
# терминал 2
cd webapp && npm run dev    # Vite :5173, проксирует /api → :3000
```
Открыть `http://localhost:5173`. UI отрисуется, но API вернёт **401** (нет `initData`).
Для верстки/логики можно временно замокать `webapp/src/api.ts`. Оплата и TON Connect требуют Telegram (Режим A).

---

## Траблшутинг
| Симптом | Причина / решение |
|---|---|
| Бот не стартует, 401 от Telegram | неверный `BOT_TOKEN` |
| В Mini App «invalid initData» | открыли не из Telegram, или `BOT_TOKEN` в бэке ≠ токену бота, которым открыт Mini App |
| Белый экран Mini App | не сделан `npm run build`; проверьте лог `serving webapp from ...` и откройте туннель-URL в браузере |
| ngrok показывает предупреждение | нажмите Visit Site, либо используйте `cloudflared` (без интерстишела) |
| TON Connect не открывается | `{tunnel}/tonconnect-manifest.json` недоступен по HTTPS / `url` в манифесте не совпадает |
| `relation ... does not exist` | не применена схема — шаг 4 |
| Postgres connection refused | `docker compose up -d` не поднялся; смотрите `docker compose logs postgres` |
| tonapi rate limit / нет SSE | добавьте `TONAPI_KEY` |
| Поменяли фронт, изменений нет | в Режиме A пересоберите: `cd webapp && npm run build` |
| ngrok-URL меняется при рестарте | на free-плане URL новый каждый раз → обновляйте `.env` и BotFather; либо статический домен/`cloudflared` |
