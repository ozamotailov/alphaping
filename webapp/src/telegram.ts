// Тонкая типобезопасная обёртка над window.Telegram.WebApp (официальный telegram-web-app.js).
// Подключаем только то, что используем.

type InvoiceStatus = "paid" | "cancelled" | "failed" | "pending";

interface TelegramWebApp {
  initData: string; // подписанная строка для X-Telegram-Init-Data
  initDataUnsafe: {
    user?: { id: number; username?: string; first_name?: string; language_code?: string };
    start_param?: string;
  };
  colorScheme: "light" | "dark";
  ready(): void;
  expand(): void;
  openInvoice(url: string, callback: (status: InvoiceStatus) => void): void;
  showAlert(message: string): void;
  HapticFeedback?: {
    notificationOccurred(type: "success" | "error" | "warning"): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

export const tg: TelegramWebApp | undefined = window.Telegram?.WebApp;

// Промис-обёртка над openInvoice
export function openInvoice(url: string): Promise<InvoiceStatus> {
  return new Promise((resolve) => {
    if (!tg) return resolve("failed");
    tg.openInvoice(url, resolve);
  });
}
