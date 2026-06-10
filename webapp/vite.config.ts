import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true, // разрешаем запросы через туннель (ngrok/cloudflared)
    // Проксируем /api на бэкенд, чтобы фронт ходил по относительным путям.
    proxy: { "/api": "http://localhost:3000" },
  },
});
