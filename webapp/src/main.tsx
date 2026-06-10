import React from "react";
import ReactDOM from "react-dom/client";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import App from "./App";
import { tg } from "./telegram";
import "./styles.css";

// Сообщаем Telegram, что приложение готово, и разворачиваем на весь экран.
tg?.ready();
tg?.expand();

const manifestUrl =
  import.meta.env.VITE_TONCONNECT_MANIFEST ||
  `${window.location.origin}/tonconnect-manifest.json`;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <App />
    </TonConnectUIProvider>
  </React.StrictMode>,
);
