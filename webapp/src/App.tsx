import { useCallback, useEffect, useState } from "react";
import { TonConnectButton, useTonAddress } from "@tonconnect/ui-react";
import { api } from "./api";
import { tg, openInvoice } from "./telegram";
import type { ApiError, Me, SmartMoney, WatchItem } from "./types";

export default function App() {
  const tonAddress = useTonAddress(); // friendly-адрес или "" если не подключён
  const [me, setMe] = useState<Me | null>(null);
  const [watches, setWatches] = useState<WatchItem[]>([]);
  const [sm, setSm] = useState<SmartMoney | null>(null);
  const [addr, setAddr] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, w, s] = await Promise.all([api.me(), api.watchlist(), api.smartMoney()]);
      setMe(m);
      setWatches(w);
      setSm(s);
    } catch (e) {
      setErr(humanError(e as ApiError));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Передаём подключённый TON-адрес на бэкенд (read-only, без ключей)
  useEffect(() => {
    if (tonAddress) api.setTonAddress(tonAddress).catch(() => {});
  }, [tonAddress]);

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
              <span className="muted small">{w.label ?? ""}</span>
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

function humanError(e: ApiError): string {
  if (e?.status === 401) return "Откройте приложение из Telegram (нет initData).";
  return e?.message || "Ошибка";
}
