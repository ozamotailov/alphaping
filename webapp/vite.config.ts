import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    react(),
    // TON-библиотеки (@ton/core, @ston-fi/sdk) используют Node-глобалы Buffer/global —
    // в браузере их нет, поэтому полифиллим, иначе Mini App падает белым экраном.
    nodePolyfills({ globals: { Buffer: true, global: true, process: true } }),
  ],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true, // разрешаем запросы через туннель (ngrok/cloudflared)
    // Проксируем /api на бэкенд, чтобы фронт ходил по относительным путям.
    proxy: { "/api": "http://localhost:3000" },
  },
});
