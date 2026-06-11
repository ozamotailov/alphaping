# Деплой TonSonar в прод (24/7)

Подход: **один сервис** — бэкенд раздаёт и `/api`, и собранный фронтенд (под одним доменом,
без CORS и второго деплоя). База — **Railway** (managed Postgres + Redis в один клик).
Тот же `Dockerfile` заведётся на Fly.io и обычном VPS.

Что уже подготовлено:
- `Dockerfile` (мультистейдж: сборка фронта → runtime на `tsx`)
- `.dockerignore`
- Авто-применение схемы БД при старте (`src/db/migrate.ts`) — отдельный `db:init` в проде не нужен
- Бот работает на long polling (для одного инстанса прод-ок; webhook не обязателен)

---

## Вариант 1 — Railway (рекомендуется)

### 1. Запушить репозиторий
```bash
cd alphaping && git add -A && git commit -m "Deploy config" && git push
```

### 2. Создать проект
- railway.app → **New Project** → **Deploy from GitHub repo** → выбрать `ozamotailov/alphaping`.
- Railway найдёт `Dockerfile` и соберёт образ.

### 3. Добавить базы
- В проекте: **+ New** → **Database** → **PostgreSQL**.
- Ещё раз **+ New** → **Database** → **Redis**.

### 4. Переменные окружения (сервис приложения → Variables)
| Переменная | Значение |
|---|---|
| `BOT_TOKEN` | токен из @BotFather |
| `TONAPI_KEY` | ключ tonconsole.com (рекомендуется для стабильного SSE) |
| `ADMIN_ID` | твой Telegram id |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (ссылка на плагин) |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` (ссылка на плагин) |
| `WEBAPP_URL` | домен сервиса (см. шаг 5) |

> `PORT` Railway подставляет сам — задавать не нужно (приложение слушает `process.env.PORT`).

### 5. Домен
- Сервис → **Settings → Networking → Generate Domain** → получишь `https://xxx.up.railway.app`.
- Впиши его в `WEBAPP_URL` → Railway передеплоит.

> Если первый деплой упал из-за пустого `WEBAPP_URL` (zod требует URL) — поставь временно
> `https://example.com`, сгенерируй домен, замени на него и передеплой.

### 6. Схема БД
Применяется автоматически при старте (идемпотентно). Ручной шаг не нужен.

### 7. Привязать бота
- @BotFather → `/mybots` → бот → **Bot Settings → Menu Button → Edit menu button URL** → вставь домен.
- (Опц.) Полиш: `/setname` → TonSonar, `/setdescription`, `/setuserpic`.

### 8. TON Connect манифест
Манифест раздаётся по `https://<домен>/tonconnect-manifest.json`. Чтобы кошельки не ругались на
несовпадение, замени в `webapp/public/tonconnect-manifest.json` поля `url`/`iconUrl` на боевой домен,
закоммить и передеплой.

### 9. Проверка
- `https://<домен>/health` → `{"ok":true}`.
- Логи Railway: `schema applied`, `API listening`, `bot @<username> started`.
- Открой бота → Menu Button → Mini App → подключи кошелёк → тест.
- Smart-money: дождись авто-прогона (через 15с и каждые 6ч) или вызови `/rebuildsm` (админ).

---

## Вариант 2 — Fly.io (кратко)
```bash
fly launch            # обнаружит Dockerfile, не деплоить сразу
fly postgres create   # и: fly postgres attach <pg-app>  → даст DATABASE_URL
# Redis: создать Upstash Redis (fly ext redis create) → REDIS_URL
fly secrets set BOT_TOKEN=... TONAPI_KEY=... ADMIN_ID=... WEBAPP_URL=https://<app>.fly.dev
fly deploy
```

## Вариант 3 — VPS (Docker)
```bash
# Postgres+Redis — через имеющийся docker-compose.yml, приложение — образом из Dockerfile:
docker build -t tonsonar .
docker run -d --env-file .env -p 3000:3000 --name tonsonar tonsonar
# + reverse-proxy (Caddy/Nginx) с HTTPS на порт 3000, домен → в WEBAPP_URL и BotFather.
```

---

## Опционально — фронт отдельно на Cloudflare Pages
Если захочешь разнести: задеплой `webapp/dist` на Cloudflare Pages, в его билд-окружении задай
`VITE_API_URL=https://<домен бэкенда>`, а бэкенд оставь только под `/api`. Для MVP это не нужно —
单 сервис проще.

## Заметки
- **Long polling vs webhook:** для одного инстанса long polling ок. Webhook нужен при горизонтальном
  масштабировании/serverless — тогда переключить `bot.start()` на `webhookCallback` и эндпоинт.
- **SSL к Postgres:** внутри Railway/Fly приватная сеть — SSL не требуется. Если внешняя БД ругается —
  добавь `?sslmode=require` в `DATABASE_URL`.
- **Стоимость данных:** листинги опрашивают `/v1/pools` (~44 МБ) раз в 5 мин — следи за исходящим
  трафиком; при необходимости увеличь интервал в `startListingPolling`.
