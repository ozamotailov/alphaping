# ---- Стадия 1: сборка фронтенда (webapp/dist) ----
FROM node:20-slim AS webapp
WORKDIR /app/webapp
COPY webapp/package*.json ./
RUN npm ci
COPY webapp/ ./
RUN npm run build

# ---- Стадия 2: runtime (бэкенд + раздача собранного фронта) ----
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
# Только prod-зависимости бэкенда (tsx входит в dependencies — на нём и запускаемся)
COPY package*.json ./
RUN npm ci --omit=dev
# Исходники бэкенда (запуск через tsx, без отдельной сборки)
COPY tsconfig.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/
# Собранный фронтенд из стадии 1 — его раздаёт Express (express.static)
COPY --from=webapp /app/webapp/dist ./webapp/dist
EXPOSE 3000
CMD ["npm", "run", "start"]
