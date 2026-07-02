# Как получить анонс TonSonar в канале STON.fi (@stonfidex)

## Ключевой принцип
Анонсы в @stonfidex — **earned, не paid**. Нет «прайса на пост». STON.fi сама постит проекты,
которые **рекламируют её же инфраструктуру**:
- интеграция STON.fi SDK / **Omniston** (пример: Gramstox — «integrated Omniston… directly inside the Mini-App»);
- **грантополучатели** (пример: Teleswap — «received technical and financial support through STON.fi's grant program» → farming spotlight);
- победители хакатонов.

**TonSonar уже попадает в профиль:** **Omniston-роутинг интегрирован** (кнопка «Buy on STON.fi»
в алертах → своп через RFQ-агрегатор Omniston, объём на инфру STON.fi) + прямой Swap SDK как
фолбэк + DeFi-грант подан. Питч строим не как «дайте рекламу», а как «готовый integration-кейс
именно на Omniston, который гонит вам volume» — а свежие спотлайты @stonfidex ровно про Omniston.

## Куда писать (по теплоте)
1. **Через грант-тред** — если есть менеджер/контакт по поданному STON.fi DeFi Grant, co-marketing
   часто прямой деливерабл гранта. Самый тёплый вход.
2. **@stonfiofficial** — партнёрства/cooperation (основной BD-контакт).
3. **PR-менеджер** — email на странице **ston.fi/press-room** (для media collaboration / spotlight).
4. **Dev Announcements** — STON.fi отдельно показывает интеграции для билдеров; интеграционный
   showcase ложится и сюда.

Бренд-ассеты STON.fi (если нужны для оформления поста): Figma Brand Book — ссылка на ston.fi/press-room.

## Что приложить (пакет, снижает их усилия → выше шанс «да»)
- [ ] Готовый **blurb для поста** (EN, 2–4 строки) — ниже.
- [ ] **Логотип** 512×512 (`webapp/public/logo-512.png`).
- [ ] 1–2 **скриншота** свопа или короткий **GIF** флоу «alert → Buy on STON.fi → swap».
- [ ] **Демо-видео** 60 сек (уже есть, YouTube).
- [ ] Ссылки: Mini App, бот, репо, лендинг.
- [ ] Доказательство интеграции: **Omniston SDK** (`@ston-fi/omniston-sdk`, RFQ через
      `wss://omni-ws.ston.fi`, `tonBuildSwap`) + прямой `@ston-fi/sdk` как фолбэк + TON Connect;
      smart-money из `/v1/stats/operations`, листинги из `/v1/pools`.
- [ ] Упомянуть поданный **DeFi Grant** (и ID, если присвоен).

**Усилитель — СДЕЛАНО:** TonSonar теперь роутит свопы через **Omniston** (RFQ-агрегатор STON.fi,
который они продвигают билдерам — спотлайты Gramstox именно про него), с откатом на прямой Swap
SDK, если у Omniston нет маршрута. Живьём проверено: RFQ-котировка TON→jetton + `tonBuildSwap`
отдают готовую транзакцию. Это делает кейс максимально «их» и усиливает повод для поста.

---

## Готовый питч (DM на @stonfiofficial / в грант-тред)

> Hi! I'm the solo dev behind **TonSonar** (@tonsonar_bot) — a TON smart-money alerts Mini App
> with **one-tap STON.fi swaps** built in.
>
> We shipped a live STON.fi integration: every smart-money and new-listing alert carries a
> **"Buy on STON.fi"** button that opens an in-app swap **routed through Omniston** — your
> RFQ aggregator (`@ston-fi/omniston-sdk` + TON Connect), with a direct Swap SDK fallback. It
> turns a signal into an Omniston-routed swap in one tap — driving volume straight to your rails.
> We also auto-discover smart money from `/v1/stats/operations` and detect new listings from
> `/v1/pools`.
>
> We've also applied to the **STON.fi DeFi Grant** (each milestone grows STON.fi volume).
>
> Would you be open to featuring TonSonar in an ecosystem/integration spotlight on @stonfidex?
> I can send a ready-to-post blurb, logo, screenshots, and a 60-sec demo — whatever's easiest
> for you to drop in.
>
> Mini App: https://t.me/tonsonar_bot
> Demo: https://youtu.be/RHRY2dgy8A8
> Repo: https://github.com/ozamotailov/alphaping
>
> Thanks for building the rails — happy to be a showcase for them. 🛰️

---

## Готовый blurb для самого поста (если попросят прислать текст)

> **TonSonar — smart-money radar for TON, with one-tap STON.fi swaps.** 🛰️
> Get pinged the second a top wallet trades or a new jetton lists — then swap it in one tap,
> routed through Omniston, without leaving Telegram. Built on STON.fi Omniston + TON Connect.
> 👉 https://t.me/tonsonar_bot

(EN основной; при желании дать и RU-версию из `STORE_TONAPP.md`.)
