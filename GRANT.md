# Гранты для TonSonar — план и готовая заявка

Два трека (по итогам ресёрча, июнь 2026):

1. **STON.fi DeFi Grant** — открытый, evergreen, до **$10 000 USDT**, строго на разработку.
   Лучший фит: мы интегрируем STON.fi и гоним на него объём. ← основной таргет, заявка ниже.
2. **TON Foundation** — открытых заявок нет; путь через Builders Portal + TON Hub + хакатоны.

---

## Трек 1 — STON.fi DeFi Grant (готовая заявка, EN — подавать на ston.fi/grant-program)

> Форма англоязычная — текст ниже paste-ready. Усиление под критерии гранта: добавляем
> **STON.fi Swap SDK/widget** («alert → one-tap swap»), что напрямую двигает объём STON.fi.

### Project name
**TonSonar** — smart-money & wallet alerts for TON, with one-tap STON.fi swaps.

### One-liner
A Telegram Mini App that tracks TON wallets and "smart money", alerts on their swaps and new
jetton listings, shows portfolio/PnL — and lets users act on signals by swapping instantly via STON.fi.

### Problem
TON traders miss alpha: they can't see in real time what successful wallets buy/sell, when new
jettons list, or whether a new token is a scam. Existing TON trackers are basic (raw transfers,
price alerts) with no curation, PnL, or a path from signal to action.

### Solution
TonSonar (live MVP) delivers: real-time wallet/smart-money alerts (tonapi SSE), new STON.fi jetton
listings with an anti-scam safety check, curated smart-money lists scored by realized PnL & win-rate,
a portfolio/PnL view — **and one-tap swaps routed through STON.fi** directly from an alert or holding,
closing the loop from signal to trade.

### STON.fi integration (already shipped + roadmap)
- **Swap SDK integrated (live):** TON→jetton swaps via `@ston-fi/sdk` + TON Connect, with quotes
  from `/v1/swap/simulate` (pTON v1/v2 auto-routing). "🟢 Купить на STON.fi" buttons on new-listing
  and smart-money buy alerts open the Mini App and pre-fill the swap → **drives volume to STON.fi routers**.
- **Data integration (live):** `/v1/stats/operations` (smart-money discovery), `/v1/pools`
  (new-listing detection + liquidity filtering for the safety score).
- **Funnel:** alert (new listing / smart-money buy) → one-tap STON.fi swap. Grant funds deepening
  this funnel (see milestones), not building it from scratch.

### Ecosystem benefit
Drives incremental swap volume to STON.fi, onboards traders into TON DeFi from a low-friction
Telegram surface (UA ~$0.10–0.50/user vs $5–20 in classic Web3), and turns passive alerts into
on-chain actions routed through STON.fi.

### Current status / traction (already built & deployed)
- Live MVP (bot + Mini App) deployed 24/7 on Railway; open-source repo; brand + logo.
- Shipped: Telegram Stars subscription, TON Connect, real-time ingest (tonapi SSE), STON.fi
  new-listing detection + anti-scam safety + liquidity filter, smart-money auto-discovery/scoring +
  follow, portfolio/PnL — **and live TON→jetton swaps via the STON.fi SDK (alert → one-tap buy).**
- Read-only by design (never requests private keys) — a trust/safety stance.

### Milestones & deliverables (FUTURE work the grant funds; development only, no outsourcing)
> The swap SDK is already integrated (above). The grant funds **deepening and scaling the
> STON.fi swap funnel**, which directly grows STON.fi volume.
- **M1 (~3 wks): Full swap surface on STON.fi.** Add sell (jetton→TON) and jetton→jetton routing,
  slippage/settings UI, price-impact warnings, and a "Swap" CTA on every alert/holding/listing.
  *Deliverable: complete two-way swapping routed via STON.fi.*
- **M2 (~3 wks): Distribution that routes volume to STON.fi.** Shareable STON.fi swap deep-links and
  an embeddable "swap signal" widget so other TON channels/communities funnel swaps through STON.fi;
  referral mechanics. *Deliverable: external embed/deep-link flow → STON.fi swaps.*
- **M3 (~2 wks): In-app signal→swap feed.** A live alerts feed in the Mini App where each new-listing
  and smart-money buy carries a one-tap STON.fi swap CTA. *Deliverable: feed that converts signals
  to STON.fi swaps.*

### Budget / use of funds ($10,000, dev only)
M1 $4,000 · M2 $3,500 · M3 $2,500. Strictly coding/debugging/testing per program rules; solo dev,
no outsourcing; IP retained with open-source licensing.

### Team
Solo full-stack/blockchain developer (bots, Telegram Mini Apps, smart contracts, AI pipelines).
Built the live MVP end-to-end.

### Community engagement & compliance
Will publish progress and "alpha" signals in a public TON channel, engage the STON.fi community,
and operate read-only (no custody) in line with regional requirements.

### Links
- Bot: https://t.me/<your_bot_username>
- Mini App: https://alphaping-production.up.railway.app
- Repo: https://github.com/ozamotailov/alphaping
- (Optional) demo video: <add a 60–90s screen recording>

### Как подать
1. Открыть **ston.fi/grant-program** → форму заявки.
2. Вставить блоки выше (поля формы могут отличаться — маппить по смыслу).
3. Приложить ссылку на репо + живой Mini App + (желательно) короткое демо-видео.
4. Дождаться письма-подтверждения и решения.

---

## Трек 2 — TON Foundation (процесс, не письменный грант)

Открытой формы нет. Шаги:
1. **TON Builders Portal** — зарегистрировать проект (eco.ton.org / society.ton.org).
2. **Региональный TON Hub (CIS)** — вступить, получить hands-on поддержку и нетворк.
3. **Хакатоны** (напр. The Open League / TON Hackathon, призовые крупные) — подать TonSonar; это и
   деньги, и видимость для экосистемных грантов/VC.
4. **grants-and-bounties** (github.com/ton-society/grants-and-bounties) — отслеживать баунти,
   часть из них закрывается нашим стеком (TON-data, Mini Apps).

> Для обоих треков нужен «пакет»: живой Mini App (есть), репо (есть), 60–90с демо-видео (сделать),
> 1-страничный one-pager (выжимка из заявки выше). Демо-видео — самый недооценённый множитель.

---

## Что усилит шансы (мини-беклог под грант)
- [x] STON.fi Swap SDK в Mini App (TON→jetton, alert→one-tap) — **сделано** (это traction).
- [x] Логотип/бренд — **сделано** (logo.svg + icon-180.png).
- [ ] 60–90с демо-видео сценария: alert → открыть приложение → swap на STON.fi (см. DEMO.md).
- [ ] Публичный канал с парой реальных «alpha»-сниппетов (показывает community engagement).
- [ ] One-pager (PDF) с метриками и скриншотами.
