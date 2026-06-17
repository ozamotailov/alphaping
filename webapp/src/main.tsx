import React from "react";
import ReactDOM from "react-dom/client";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import App from "./App";
import { tg } from "./telegram";
import { initAnalytics } from "./analytics";
import "./styles.css";

// Сообщаем Telegram, что приложение готово, и разворачиваем на весь экран.
tg?.ready();
tg?.expand();

// Аналитика Telegram Mini Apps (DataChief) — инициализируем ДО рендера (требование SDK).
// No-op, пока не заданы VITE_ANALYTICS_TOKEN / VITE_ANALYTICS_APP.
initAnalytics();

// Показ фатальной ошибки прямо в DOM (на телефоне консоли нет) — только если приложение
// ещё не смонтировалось (истинный «белый экран»), чтобы не затирать рабочий UI.
function showFatal(msg: string) {
  const root = document.getElementById("root");
  if (root && !root.firstChild) {
    root.innerHTML =
      '<div style="padding:16px;font:14px system-ui;color:#ff6b6b">' +
      "Ошибка загрузки:<br><pre style=\"white-space:pre-wrap\">" +
      msg.replace(/[<>]/g, "") +
      "</pre></div>";
  }
}
window.addEventListener("error", (e) => showFatal(String(e.message || e.error)));
window.addEventListener("unhandledrejection", (e) => showFatal(String(e.reason)));

const manifestUrl =
  import.meta.env.VITE_TONCONNECT_MANIFEST ||
  `${window.location.origin}/tonconnect-manifest.json`;

try {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <TonConnectUIProvider manifestUrl={manifestUrl}>
        <App />
      </TonConnectUIProvider>
    </React.StrictMode>,
  );
} catch (e) {
  showFatal(String(e));
}
