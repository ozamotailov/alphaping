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
and a portfolio/PnL view. **Grant-funded addition:** integrate the STON.fi Swap SDK so users swap a
jetton in one tap directly from an alert or their portfolio — closing the loop from signal to trade.

### STON.fi integration (core of this grant)
- **Swap SDK/widget** embedded in the Mini App: "Buy/Sell on STON.fi" from any alert, listing, or
  holding (drives swap volume to STON.fi routers).
- **Data integration already live:** `/v1/stats/operations` (smart-money discovery), `/v1/pools`
  (new-listing detection + liquidity for safety scoring).
- **New-listing funnel:** surface fresh STON.fi pools (with safety badges) → one-tap swap.

### Ecosystem benefit
Drives incremental swap volume to STON.fi, onboards traders into TON DeFi from a low-friction
Telegram surface (UA ~$0.10–0.50/user vs $5–20 in classic Web3), and turns passive alerts into
on-chain actions routed through STON.fi.

### Current status / traction
- Live MVP (bot + Mini App) deployed 24/7; open-source repo.
- Built: Telegram Stars subscription, TON Connect, real-time ingest (tonapi SSE), STON.fi listing
  detection + safety, smart-money auto-discovery/scoring + follow, portfolio/PnL.
- Read-only by design (never requests private keys) — a trust/safety stance.

### Milestones & deliverables (development only, no outsourcing)
- **M1 (~3 wks): STON.fi Swap SDK integration.** "Swap on STON.fi" from alert/portfolio/listing;
  quote, slippage, TON Connect signing. *Deliverable: working in-app swaps routed via STON.fi.*
- **M2 (~3 wks): STON.fi-powered analytics hardening.** Robust pool/jetton safety (liquidity, LP
  lock, holder concentration), smart-money scoring on STON.fi operations. *Deliverable: reliable
  listing + smart-money pipeline.*
- **M3 (~2 wks): Distribution.** Shareable "swap on STON.fi" deep-links + channel widget so other
  TON communities embed TonSonar signals → STON.fi swaps. *Deliverable: referral/embed flow.*

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
- [ ] STON.fi Swap SDK в Mini App (это и есть M1 — делает фит грантa очевидным).
- [ ] 60–90с демо-видео сценария: alert → открыть приложение → swap на STON.fi.
- [ ] Публичный канал с парой реальных «alpha»-сниппетов (показывает community engagement).
- [ ] One-pager (PDF) с метриками и скриншотами.
