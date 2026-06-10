import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import fs from "node:fs";
import type { Bot } from "grammy";
import { config } from "../config";
import type { Repo } from "../db/repo";
import { validateInitData } from "./auth";
import { createSubscriptionInvoice, PLANS, type PlanId } from "../bot/payments";
import { SMART_LIST_NAME } from "../constants";
import { getPortfolio } from "../ingest/portfolio";
import { normalizeAddress } from "../lib/ton";
import { logger } from "../lib/logger";

// Расширяем Request полем userId, проставляемым auth-мидлвейром.
interface AuthedRequest extends Request {
  userId?: number;
}

export function createServer(bot: Bot, repo: Repo) {
  const app = express();
  app.use(express.json());

  // CORS для фронтенда Mini App (ужесточите origin в проде).
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type, X-Telegram-Init-Data");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  app.get("/health", (_req, res) => res.json({ ok: true }));

  // Аутентификация по initData из заголовка X-Telegram-Init-Data.
  const auth = (req: AuthedRequest, res: Response, next: NextFunction) => {
    const initData = req.header("x-telegram-init-data") ?? "";
    const v = validateInitData(initData, config.BOT_TOKEN);
    if (!v) return res.status(401).json({ error: "invalid initData" });
    req.userId = v.userId;
    next();
  };

  // Профиль/тариф
  app.get("/api/me", auth, async (req: AuthedRequest, res) => {
    await repo.upsertUser(req.userId!);
    res.json((await repo.getUser(req.userId!)) ?? { tier: "free" });
  });

  // Ссылка на инвойс подписки — фронтенд откроет её через WebApp.openInvoice(link)
  app.post("/api/invoice", auth, async (req: AuthedRequest, res) => {
    const plan = req.body?.plan as PlanId;
    if (!plan || !PLANS[plan]) return res.status(400).json({ error: "unknown plan" });
    try {
      const link = await createSubscriptionInvoice(bot, req.userId!, plan);
      res.json({ link });
    } catch (e) {
      logger.error("invoice error", String(e));
      res.status(500).json({ error: "invoice failed" });
    }
  });

  // Привязать TON-кошелёк (после TON Connect на фронте)
  app.post("/api/ton-address", auth, async (req: AuthedRequest, res) => {
    const norm = normalizeAddress(String(req.body?.address ?? ""));
    if (!norm) return res.status(400).json({ error: "bad address" });
    await repo.setTonAddress(req.userId!, norm.raw);
    res.json({ ok: true, address: norm.friendly });
  });

  // Портфель/PnL по подключённому (или переданному) TON-адресу.
  app.get("/api/portfolio", auth, async (req: AuthedRequest, res) => {
    const user = await repo.getUser(req.userId!);
    const address = (typeof req.query.address === "string" && req.query.address) || user?.ton_address || "";
    if (!address) return res.json({ connected: false });
    try {
      const p = await getPortfolio(address);
      res.json({ connected: true, ...p });
    } catch (e) {
      logger.error("portfolio error", String(e));
      res.status(502).json({ error: "portfolio_failed" });
    }
  });

  // Watchlist
  app.get("/api/watchlist", auth, async (req: AuthedRequest, res) => {
    res.json(await repo.listWatches(req.userId!));
  });

  app.post("/api/watch", auth, async (req: AuthedRequest, res) => {
    const norm = normalizeAddress(String(req.body?.address ?? ""));
    if (!norm) return res.status(400).json({ error: "bad address" });
    const r = await repo.addWatch(req.userId!, norm, req.body?.label);
    if (r.limited) return res.status(402).json({ error: "limit_reached", upsell: "pro" });
    res.json({ ok: true, walletId: r.walletId });
  });

  app.delete("/api/watch/:id", auth, async (req: AuthedRequest, res) => {
    const walletId = Number(req.params.id);
    if (!Number.isFinite(walletId)) return res.status(400).json({ error: "bad id" });
    await repo.removeWatch(req.userId!, walletId);
    res.json({ ok: true });
  });

  // Кураторский smart-money список. Free видит только количество (locked), Pro/Whale — состав + статус подписки.
  app.get("/api/smart-money", auth, async (req: AuthedRequest, res) => {
    const user = await repo.getUser(req.userId!);
    const isPro = user?.tier === "pro" || user?.tier === "whale";
    const members = await repo.getSmartListMembers(SMART_LIST_NAME, 50);
    if (!isPro) return res.json({ locked: true, count: members.length });
    res.json({ locked: false, following: !!user?.follows_smartmoney, members });
  });

  // Подписка/отписка на smart-money список (Pro/Whale). Не тратит лимит кошельков:
  // при follow ingest начинает покрывать участников списка, а доставка добавляет фолловера в получатели.
  app.post("/api/smart-money/follow", auth, async (req: AuthedRequest, res) => {
    const user = await repo.getUser(req.userId!);
    const isPro = user?.tier === "pro" || user?.tier === "whale";
    if (!isPro) return res.status(402).json({ error: "pro_required", upsell: "pro" });
    const on = req.body?.on !== false; // по умолчанию true
    await repo.setFollowSmartMoney(req.userId!, on);
    res.json({ ok: true, following: on });
  });

  // TODO: /api/portfolio, /api/launches, /api/alerts ...

  // Опционально раздаём собранный фронтенд (webapp/dist) с того же origin, что и /api —
  // это позволяет тестировать в Telegram под ОДНИМ туннелем. Если dist нет — пропускаем.
  const webappDist = path.resolve(process.cwd(), "webapp", "dist");
  if (fs.existsSync(webappDist)) {
    app.use(express.static(webappDist));
    app.get("*", (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(webappDist, "index.html"));
    });
    logger.info(`serving webapp from ${webappDist}`);
  }

  return app;
}
