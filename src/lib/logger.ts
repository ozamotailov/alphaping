// Минимальный логгер без внешних зависимостей. Замените на pino при необходимости.
type Level = "info" | "warn" | "error" | "debug";

function log(level: Level, msg: unknown, extra?: unknown) {
  const ts = new Date().toISOString();
  const line = typeof msg === "string" ? msg : JSON.stringify(msg);
  const tail = extra === undefined ? "" : " " + (typeof extra === "string" ? extra : JSON.stringify(extra));
  // eslint-disable-next-line no-console
  console[level === "debug" ? "log" : level](`[${ts}] ${level.toUpperCase()} ${line}${tail}`);
}

export const logger = {
  info: (m: unknown, e?: unknown) => log("info", m, e),
  warn: (m: unknown, e?: unknown) => log("warn", m, e),
  error: (m: unknown, e?: unknown) => log("error", m, e),
  debug: (m: unknown, e?: unknown) => log("debug", m, e),
};
