import crypto from "node:crypto";

export interface InitDataResult {
  userId: number;
  user: { id: number; username?: string; first_name?: string };
  raw: URLSearchParams;
}

/**
 * Валидация Telegram Mini App initData (см. Telegram docs «Validating data received via the Mini App»).
 * Алгоритм:
 *   secret_key   = HMAC_SHA256(key="WebAppData", message=bot_token)
 *   computed_hash = HMAC_SHA256(key=secret_key, message=data_check_string)
 * где data_check_string — пары "key=value" (кроме hash), отсортированные и склеенные через \n.
 *
 * Возвращает данные пользователя при валидной подписи, иначе null.
 */
export function validateInitData(
  initData: string,
  botToken: string,
  maxAgeSec = 86400,
): InitDataResult | null {
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computed = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  // timing-safe сравнение
  const a = Buffer.from(computed, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  // защита от replay: проверяем свежесть auth_date
  const authDate = Number(params.get("auth_date") ?? 0);
  if (maxAgeSec > 0 && authDate > 0) {
    const ageSec = Math.floor(Date.now() / 1000) - authDate;
    if (ageSec > maxAgeSec) return null;
  }

  const userJson = params.get("user");
  if (!userJson) return null;
  let user: InitDataResult["user"];
  try {
    user = JSON.parse(userJson);
  } catch {
    return null;
  }
  if (!user?.id) return null;

  return { userId: user.id, user, raw: params };
}
