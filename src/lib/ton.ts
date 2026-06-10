import { Address } from "@ton/core";

// TON-адрес имеет несколько форматов (raw `0:...` vs friendly `EQ.../UQ...`,
// bounceable/non-bounceable). ВСЕГДА нормализуем к raw перед дедупом в БД,
// иначе один и тот же кошелёк задвоится.
export function normalizeAddress(input: string): { raw: string; friendly: string } | null {
  try {
    const a = Address.parse(input.trim());
    return {
      raw: a.toRawString(), // 0:abc...  — ключ для БД/сравнения
      friendly: a.toString({ bounceable: false, urlSafe: true }), // UQ... — для UI
    };
  } catch {
    return null;
  }
}

export function shortAddr(raw: string): string {
  const friendly = (() => {
    try {
      return Address.parseRaw(raw).toString({ bounceable: false, urlSafe: true });
    } catch {
      return raw;
    }
  })();
  return friendly.slice(0, 4) + "…" + friendly.slice(-4);
}
