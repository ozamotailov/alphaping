# TonSonar — One-Pager

> Экспортируй в PDF (например, открыть в любом markdown→PDF, или печать из браузера) и приложи к заявке.

---

## TonSonar
**Smart-money & wallet alerts for TON, with one-tap STON.fi swaps — inside Telegram.**

**Problem.** TON traders miss the moment smart money moves: there's no real-time view of what
successful wallets buy/sell, when new jettons list, or whether a token is a scam — and no path from
signal to trade. Existing TON trackers are basic (raw transfers, price alerts), with no curation,
no PnL, and no action.

**Solution (live MVP, deployed 24/7).**
- Real-time wallet & **smart-money** alerts (tonapi SSE)
- **New jetton listings on STON.fi** with an anti-scam safety check + liquidity filter
- **Curated smart-money lists** — auto-discovered from STON.fi swappers, scored by realized PnL & win-rate
- **Portfolio & PnL**
- **One-tap TON → jetton swaps routed through STON.fi**, from any alert or holding (signal → trade)
- Read-only (never requests private keys); bilingual EN/RU

**STON.fi integration (already shipped).** Swaps via `@ston-fi/sdk` + TON Connect; quotes from
`/v1/swap/simulate` (pTON v1/v2 auto-routing). Smart-money discovery from `/v1/stats/operations`;
new-listing detection + liquidity from `/v1/pools`. "Buy on STON.fi" buttons on alerts open the Mini
App pre-filled → **drives swap volume to STON.fi routers**.

**Traction.** Live bot + Mini App (open-source); brand & logo; Telegram Stars monetization (Pro/Whale);
cheap Telegram-native distribution (UA ~$0.10–0.50/user vs $5–20 in classic Web3).

**What the grant funds** (development only; each milestone grows STON.fi volume):
| Milestone | Deliverable | Budget |
|---|---|---|
| **M1** — Full swap surface | sell (jetton→TON), jetton→jetton, slippage UI, swap CTA everywhere | $4,000 |
| **M2** — Distribution | shareable STON.fi swap deep-links + embeddable widget for TON channels | $3,500 |
| **M3** — Signal→swap feed | in-app alerts feed, each with a one-tap STON.fi swap CTA | $2,500 |

**Ask.** Up to **$10,000** (STON.fi DeFi Grant). Solo dev, no outsourcing, IP retained, open-source.

**Team.** Solo full-stack / blockchain developer (bots, Telegram Mini Apps, smart contracts,
AI pipelines) — built the live MVP end-to-end.

**Links.**
- Mini App: https://alphaping-production.up.railway.app
- Bot: https://t.me/tonsonar_bot
- Repo: https://github.com/ozamotailov/alphaping
- Demo video: https://youtu.be/RHRY2dgy8A8?is=8rePt7aR8aQzWz3q

**Stack.** TypeScript · grammY · Express · BullMQ · Postgres · React/Vite · TON Connect · `@ston-fi/sdk`.
