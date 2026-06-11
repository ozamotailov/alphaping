import { useCallback, useEffect, useState } from "react";
import { TonConnectButton, useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { api } from "./api";
import { tg, openInvoice } from "./telegram";
import { quoteTonToJetton, buildTonToJettonTx, type SwapQuote } from "./swap";
import type { ApiError, Me, Portfolio, SmartMoney, WatchItem } from "./types";

interface SwapTarget {
  jetton: string;
  symbol: string;
  decimals: number;
}

export default function App() {
  const tonAddress = useTonAddress(); // friendly-адрес или "" если не подключён
  const [tonConnectUI] = useTonConnectUI();
  const [me, setMe] = useState<Me | null>(null);
  const [watches, setWatches] = useState<WatchItem[]>([]);
  const [sm, setSm] = useState<SmartMoney | null>(null);
  const [pf, setPf] = useState<Portfolio | null>(null);
  const [addr, setAddr] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Своп
  const [swapTarget, setSwapTarget] = useState<SwapTarget | null>(null);
  const [swapAmount, setSwapAmount] = useState("1");
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [quoting, setQuoting] = useState(false);

  const openSwap = useCallback(async (jetton: string, symbol?: string, decimals?: number) => {
    setQuote(null);
    setSwapTarget({ jetton, symbol: symbol ?? "", decimals: decimals ?? 9 });
    if (!symbol) {
      try {
        const m = await api.jettonMeta(jetton);
        setSwapTarget({ jetton, symbol: m.symbol, decimals: m.decimals });
      } catch {
        /* оставим адрес как есть */
      }
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [m, w, s, p] = await Promise.all([
        api.me(),
        api.watchlist(),
        api.smartMoney(),
        api.portfolio(),
      ]);
      setMe(m);
      setWatches(w);
      setSm(s);
      setPf(p);
    } catch (e) {
      setErr(humanError(e as ApiError));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Передаём подключённый TON-адрес на бэкенд (read-only, без ключей) и обновляем портфель.
  useEffect(() => {
    if (tonAddress) api.setTonAddress(tonAddress).then(() => load()).catch(() => {});
  }, [tonAddress, load]);

  // Deep-link из алерта бота: ?swap=<jetton> → открыть своп этого токена.
  useEffect(() => {
    const j = new URLSearchParams(window.location.search).get("swap");
    if (j) void openSwap(j);
  }, [openSwap]);

  // Пересчёт котировки при изменении токена/суммы.
  useEffect(() => {
    if (!swapTarget) return;
    const a = parseFloat(swapAmount);
    if (!(a > 0)) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    setQuoting(true);
    quoteTonToJetton(swapTarget.jetton, a)
      .then((q) => !cancelled && setQuote(q))
      .catch(() => !cancelled && setQuote(null))
      .finally(() => !cancelled && setQuoting(false));
    return () => {
      cancelled = true;
    };
  }, [swapTarget, swapAmount]);

  async function addWatch() {
    if (!addr.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await api.addWatch(addr.trim());
      setAddr("");
      setWatches(await api.watchlist());
      tg?.HapticFeedback?.notificationOccurred("success");
    } catch (e) {
      const er = e as ApiError;
      if (er.status === 402) setErr("Достигнут лимит кошельков на Free. Оформите Pro 👇");
      else setErr(humanError(er));
    } finally {
      setBusy(false);
    }
  }

  async function toggleFollow() {
    if (!sm) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api.followSmartMoney(!sm.following);
      setSm({ ...sm, following: r.following });
      tg?.HapticFeedback?.notificationOccurred("success");
    } catch (e) {
      const er = e as ApiError;
      if (er.status === 402) setErr("Smart-money списки доступны в Pro.");
      else setErr(humanError(er));
    } finally {
      setBusy(false);
    }
  }

  async function removeWatch(walletId: number) {
    setBusy(true);
    setErr(null);
    try {
      await api.removeWatch(walletId);
      setWatches(await api.watchlist());
      tg?.HapticFeedback?.notificationOccurred("success");
    } catch (e) {
      setErr(humanError(e as ApiError));
    } finally {
      setBusy(false);
    }
  }

  async function doSwap() {
    if (!swapTarget || !quote) return;
    if (!tonAddress) {
      setErr("Подключите TON-кошелёк");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const msg = await buildTonToJettonTx(tonAddress, quote);
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [{ address: msg.address, amount: msg.amount, payload: msg.payload }],
      });
      setSwapTarget(null);
      setQuote(null);
      tg?.HapticFeedback?.notificationOccurred("success");
    } catch {
      setErr("Своп отменён или не прошёл.");
    } finally {
      setBusy(false);
    }
  }

  async function buyPro() {
    setBusy(true);
    setErr(null);
    try {
      const { link } = await api.invoice("pro");
      const status = await openInvoice(link);
      if (status === "paid") {
        await load();
        tg?.HapticFeedback?.notificationOccurred("success");
      } else if (status === "failed") {
        setErr("Платёж не прошёл. Попробуйте ещё раз.");
      }
    } catch (e) {
      setErr(humanError(e as ApiError));
    } finally {
      setBusy(false);
    }
  }

  const isPro = me?.tier === "pro" || me?.tier === "whale";
  const limit = me?.tier === "whale" ? "∞" : me?.tier === "pro" ? 50 : 3;

  return (
    <div className="app">
      <header className="row between">
        <div className="brand">🛰️ TonSonar</div>
        <TonConnectButton />
      </header>

      {err && (
        <div className="banner error" onClick={() => setErr(null)}>
          {err}
        </div>
      )}

      {swapTarget && (
        <section className="card upsell">
          <div className="row between">
            <div className="h">Купить {swapTarget.symbol || short(swapTarget.jetton)} на STON.fi</div>
            <button
              className="iconbtn"
              onClick={() => {
                setSwapTarget(null);
                setQuote(null);
              }}
              aria-label="Закрыть"
            >
              ✕
            </button>
          </div>
          <div className="row">
            <input
              className="input"
              inputMode="decimal"
              value={swapAmount}
              onChange={(e) => setSwapAmount(e.target.value)}
              placeholder="Сколько TON"
            />
            <span className="muted">TON</span>
          </div>
          <div className="muted small">
            {quoting
              ? "Считаю курс…"
              : quote
                ? `Получишь ≈ ${fmtQty(Number(quote.askUnits) / 10 ** swapTarget.decimals)} ${
                    swapTarget.symbol || ""
                  } · импакт ${(Number(quote.priceImpact) * 100).toFixed(2)}%`
                : "Введите сумму TON"}
          </div>
          <button className="btn primary" disabled={busy || !quote || !tonAddress} onClick={doSwap}>
            {tonAddress ? "Обменять через TON Connect" : "Сначала подключите кошелёк"}
          </button>
        </section>
      )}

      <section className="card">
        <div className="row between">
          <span>Тариф</span>
          <span className={`badge ${isPro ? "pro" : ""}`}>{me?.tier ?? "…"}</span>
        </div>
        <div className="muted small">
          Кошельков: {watches.length} / {limit}
        </div>
        {tonAddress ? (
          <div className="muted small mono">TON: {short(tonAddress)}</div>
        ) : (
          <div className="muted small">Подключите TON-кошелёк для портфеля и PnL</div>
        )}
      </section>

      {pf && (
        <section className="card">
          <div className="row between">
            <div className="h">Портфель</div>
            {pf.connected && <div className="mono">${fmtUsd(pf.totalUsd ?? 0)}</div>}
          </div>
          {pf.connected ? (
            <>
              <div className="muted small">
                TON: {(pf.ton?.qty ?? 0).toFixed(2)} (${fmtUsd(pf.ton?.usd ?? 0)}) · PnL 30д:{" "}
                <span style={{ color: (pf.realizedPnl30d ?? 0) >= 0 ? "#3ddc84" : "#ff6b6b" }}>
                  {(pf.realizedPnl30d ?? 0) >= 0 ? "+" : "−"}${fmtUsd(Math.abs(pf.realizedPnl30d ?? 0))}
                </span>
              </div>
              <ul className="list">
                {(pf.holdings ?? []).slice(0, 8).map((h) => (
                  <li key={h.address} className="row between item">
                    <span>
                      {h.verified ? "" : "⚠️ "}
                      {h.symbol}
                    </span>
                    <span className="row" style={{ gap: 10 }}>
                      <span className="muted small">${fmtUsd(h.usd)}</span>
                      <button
                        className="iconbtn"
                        disabled={busy}
                        onClick={() => openSwap(h.address, h.symbol, h.decimals)}
                        title="Купить ещё"
                      >
                        ➕
                      </button>
                    </span>
                  </li>
                ))}
                {(pf.holdings?.length ?? 0) === 0 && (
                  <li className="muted small">Нет jetton-холдингов с ценой.</li>
                )}
              </ul>
            </>
          ) : (
            <div className="muted small">
              Подключите TON-кошелёк (кнопка вверху справа), чтобы видеть портфель и PnL.
            </div>
          )}
        </section>
      )}

      <section className="card">
        <div className="h">Отслеживаемые кошельки</div>
        <div className="row">
          <input
            className="input"
            placeholder="TON-адрес (EQ.../UQ...)"
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
          />
          <button className="btn" disabled={busy} onClick={addWatch}>
            Добавить
          </button>
        </div>
        <ul className="list">
          {watches.map((w) => (
            <li key={w.id} className="row between item">
              <span className="mono">
                {short(w.address_friendly)} {w.is_smartmoney ? "⭐" : ""}
              </span>
              <button
                className="iconbtn"
                disabled={busy}
                onClick={() => removeWatch(w.id)}
                aria-label="Удалить из отслеживаемых"
                title="Удалить"
              >
                ✕
              </button>
            </li>
          ))}
          {watches.length === 0 && (
            <li className="muted small">Пока пусто — добавьте первый адрес.</li>
          )}
        </ul>
      </section>

      {sm && (
        <section className="card">
          <div className="row between">
            <div className="h">💡 Smart-money</div>
            {!sm.locked && (
              <button className="btn" disabled={busy} onClick={toggleFollow}>
                {sm.following ? "✓ Отслеживается" : "+ Отслеживать"}
              </button>
            )}
          </div>
          {sm.locked ? (
            <div className="muted small">
              🔒 {sm.count ?? 0} кошельков «умных денег» — доступно в Pro.
            </div>
          ) : (
            <ul className="list">
              {(sm.members ?? []).slice(0, 15).map((m) => (
                <li key={m.address_friendly} className="row between item">
                  <span className="mono">{short(m.address_friendly)}</span>
                  <span className="muted small">score {Math.round(m.score)}</span>
                </li>
              ))}
              {(sm.members?.length ?? 0) === 0 && (
                <li className="muted small">Список формируется автоматически — загляни позже.</li>
              )}
            </ul>
          )}
          {!sm.locked && sm.following && (
            <div className="muted small">Алерты по сделкам этих кошельков приходят в бот.</div>
          )}
        </section>
      )}

      {!isPro && (
        <section className="card upsell">
          <div className="h">TonSonar Pro — 500⭐/мес</div>
          <ul className="bullets">
            <li>50 кошельков вместо 3</li>
            <li>Реал-тайм алерты</li>
            <li>Кураторские smart-money списки</li>
            <li>Новые jetton-листинги</li>
          </ul>
          <button className="btn primary" disabled={busy} onClick={buyPro}>
            ⭐ Оформить Pro
          </button>
        </section>
      )}

      <footer className="muted small center">
        Только read-only адреса. Приватные ключи мы никогда не запрашиваем.
      </footer>
    </div>
  );
}

function short(a: string): string {
  return a.length > 12 ? a.slice(0, 4) + "…" + a.slice(-4) : a;
}

function fmtUsd(n: number): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return n.toFixed(2);
}

function fmtQty(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 1) return n.toFixed(2);
  return n.toPrecision(3);
}

function humanError(e: ApiError): string {
  if (e?.status === 401) return "Откройте приложение из Telegram (нет initData).";
  return e?.message || "Ошибка";
}
