import telegramAnalytics from "@telegram-apps/analytics";

// Telegram Mini Apps Analytics (провайдер — DataChief). Обязательно для листинга в
// tApps Center: модерация проверяет, что аналитика подключена и шлёт события.
// token + appName выдаёт @DataChief_bot (привязка к боту + домену Mini App):
//   t.me/DataChief_bot → ввести Bot URL и домен → получить SDK Auth token + app name.
// Кладём их в VITE_ANALYTICS_TOKEN / VITE_ANALYTICS_APP (Railway/билд фронта).
// Пока не заданы — no-op, ничего не шлём (локальная разработка не мусорит в стату).
export function initAnalytics(): void {
  const token = import.meta.env.VITE_ANALYTICS_TOKEN;
  const appName = import.meta.env.VITE_ANALYTICS_APP;
  if (!token || !appName) return;
  try {
    // init асинхронный; вызываем до рендера (fire-and-forget), как требует SDK.
    void telegramAnalytics.init({ token, appName });
  } catch (e) {
    // Аналитика не должна ронять приложение.
    console.warn("analytics init failed", e);
  }
}
