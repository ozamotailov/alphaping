# TonSonar — ton.app listing kit

> tApps Center больше не принимает заявки (подтверждено модерацией @tapps_center_moderation,
> июнь 2026). Подаём в **ton.app** — живой экосистемный каталог TON. Этот файл — адаптация
> `STORE.md` под ton.app. Копи переиспользуется ~1:1.

## Куда и как подавать
- Сайт: **https://ton.app** → кнопка **«Add App»** (навигация) или **«Submit your App»** (футер, раздел *For Developers*).
- Вопросы по модерации/листингу: **@tapp_support** (Telegram).
- Платное продвижение (опционально, потом): **https://ton.app/promo**.
- Модерация курируемая — подавать только отполированную версию.

## Категория
Основная: **Utilities** ("Useful tools powered by TON") — лучший дом для алерт/аналитик-тула.
Если форма даёт вторую категорию — **Exchanges DEX** (из-за one-tap свопов через STON.fi) как доп.
(Отдельной «Analytics» на ton.app нет — не искать.)

---

## Поля формы (типовые для ton.app — выверить по факту на форме)
| Поле | Значение |
|---|---|
| App name | **TonSonar** |
| Category | Utilities (доп.: Exchanges DEX) |
| Short description | см. ниже |
| Full description | см. ниже |
| Logo / icon | `webapp/public/logo-512.png` (512×512) + `logo.svg` |
| Mini App link | https://t.me/tonsonar_bot/app  *(выверить точный startapp-URL у @BotFather)* |
| Bot link | https://t.me/tonsonar_bot |
| Website | лендинг на GitHub Pages (docs/index.html) — указать боевой URL после деплоя Pages |
| TON Connect manifest | https://alphaping-production.up.railway.app/tonconnect-manifest.json |
| Terms of Use | <landing>/terms.html |
| Privacy Policy | <landing>/privacy.html |
| Socials (X / TG channel) | канал TonSonar (указать @username) |
| Screenshots | 6 шт., 9:16 (storyboard ниже) |

> NB: **DataChief-аналитика, скорее всего, НЕ нужна** — это было требование именно tApps.
> Если форма ton.app её не просит — не тратить время. При сомнении спросить @tapp_support.

---

## Name
**TonSonar**

## Tagline (короткий, «чем особенный»)
> Smart-money radar for TON — real-time alerts + one-tap swaps.

Альтернативы:
- Catch TON smart money in real time. Swap in one tap.
- Your radar for TON whales, new listings & safe swaps.

## Short description (1–2 строки)
> Track TON wallets and smart money in real time. Get pinged the instant a top wallet trades
> or a new jetton lists on STON.fi (with a scam check) — and swap in one tap, inside Telegram.

## Full description (человеческий тон)
> **TonSonar is your radar for TON.** 🛰️
>
> Stop refreshing explorers. TonSonar watches the chain for you and pings you the moment it
> matters — a top-scored wallet apes a jetton, a whale moves, or a fresh pool lists on STON.fi.
>
> **What you get:**
> 🟢 Real-time smart-money & wallet alerts
> 🚀 New jetton listings on STON.fi — with an anti-scam safety check (mint, holders, liquidity)
> 📊 Curated smart-money lists — wallets scored by realized PnL & win-rate, not just "any address"
> 💼 Portfolio & PnL for your connected wallet
> ⚡ One-tap TON → jetton swaps via STON.fi, straight from an alert
> 🔒 Read-only — we never ask for your private keys
>
> Free to start. Go Pro for more wallets, real-time delivery, and the curated smart-money lists.
> Built on TON, powered by STON.fi.

---

## Русская версия (RU)

### Tagline (RU)
> Радар smart-money для TON — алерты в реальном времени и свопы в один тап.

Альтернативы:
- Лови smart-money TON в реальном времени. Свопай в один тап.
- Твой радар по китам TON, новым листингам и безопасным свопам.

### Short description (RU)
> Следи за кошельками TON и smart-money в реальном времени. Получай пинг в момент, когда
> топовый кошелёк совершает сделку или новый джеттон выходит на STON.fi (с проверкой на скам) —
> и свопай в один тап, прямо в Telegram.

### Full description (RU)
> **TonSonar — твой радар по TON.** 🛰️
>
> Хватит обновлять эксплореры. TonSonar сам следит за блокчейном и пингует тебя в момент,
> когда это важно — топовый кошелёк заходит в джеттон, кит двигает средства или свежий пул
> выходит на STON.fi.
>
> **Что внутри:**
> 🟢 Алерты smart-money и по кошелькам в реальном времени
> 🚀 Новые листинги джеттонов на STON.fi — с анти-скам проверкой (минт, холдеры, ликвидность)
> 📊 Кураторские списки smart-money — кошельки с оценкой по реальному PnL и win-rate, а не просто «любой адрес»
> 💼 Портфель и PnL по подключённому кошельку
> ⚡ Свопы TON → джеттон в один тап через STON.fi, прямо из алерта
> 🔒 Только read-only — мы никогда не просим твои приватные ключи
>
> Старт бесплатно. Pro открывает больше кошельков, доставку в реальном времени и
> кураторские списки smart-money.
> Построено на TON, работает на STON.fi.

---

## 6 screenshots — storyboard (без изменений, валидно для ton.app)
Каждый — как **реклама**, не сырой UI: реальный экран + короткий жирный капшен (TON-blue
`#0066B8` / белый). Снимать из Mini App в Telegram, 9:16 portrait, единый стиль (свет/тёмная).
Готовые капшен-оверлеи: `store/captions/caption-1..6.svg`.

| # | Экран | Капшен |
|---|---|---|
| 1 | Hero / smart-money алерт с кнопкой **🟢 Buy on STON.fi** | **Catch smart money the second it moves** |
| 2 | Smart-money список со scores PnL / win-rate | **Curated TON smart money — scored by real PnL** |
| 3 | New-listing алерт с safety-бейджем + reasons | **New listings, with a built-in scam check** |
| 4 | Swap-панель — TON amount, live quote, price impact | **From signal to swap in one tap** |
| 5 | Portfolio / PnL | **See your TON holdings & PnL at a glance** |
| 6 | Watchlist / планы (Free vs Pro) или TON Connect | **Read-only. Your keys stay yours.** |

Слот 1 = превью, делать самым сильным. Капшены ≤ 5 слов. Показывать реальные токены/цифры
(наполненный аккаунт), чтобы не выглядело пусто.

---

## Чеклист подачи (закрыть всё перед submit)
- [x] `/start` отвечает на английском по умолчанию
- [x] TON-only + TON Connect
- [x] Terms of Use + Privacy Policy живые, контакт реальный (`@tonsonar_bot` + email)
- [x] Логотип 512×512 готов (`webapp/public/logo-512.png`)
- [x] Листинг-копи (name/tagline/short/full) — выше
- [ ] Лендинг задеплоен на GitHub Pages → боевой URL для полей Website/Terms/Privacy
- [ ] 6 скриншотов сняты по storyboard (капшены готовы в `store/captions/`)
- [ ] Выверить точный Mini App startapp-URL у @BotFather
- [ ] Подать через ton.app → «Submit your App»; при вопросах — @tapp_support
- [ ] (опц., потом) после ~150 органик-юзеров — продвижение через ton.app/promo

## После листинга — growth-nudge
Первые ~150 органик-юзеров, затем попросить 10–15 контактов открыть TonSonar **из каталога**
и заапвоутить → подъём в top-10 категории Utilities → маховик видимости.
