import { Bot } from "grammy";
import type { Repo } from "../db/repo";
import { logger } from "../lib/logger";

// Тарифы. amount — это количество ЗВЁЗД (⭐), не центы: для валюты XTR amount = число Stars.
export const PLANS = {
  pro: { title: "AlphaPing Pro", stars: 500, label: "Pro / месяц" },
  whale: { title: "AlphaPing Whale", stars: 1500, label: "Whale / месяц" },
} as const;

export type PlanId = keyof typeof PLANS;

// Единственное допустимое значение периода для Stars-подписок на текущий момент — 30 дней.
export const SUBSCRIPTION_PERIOD = 2592000;

/**
 * Создаёт ссылку на рекуррентный инвойс Telegram Stars.
 * ВАЖНО для Stars:
 *   - provider_token = "" (пусто)
 *   - currency = "XTR"
 *   - prices[i].amount = количество звёзд
 *   - subscription_period = 2592000 делает подписку авто-продлеваемой
 *
 * Сигнатура createInvoiceLink может отличаться между версиями grammy/Bot API —
 * сверьте с вашей установленной версией (здесь — позиционная форма 1.x).
 */
export async function createSubscriptionInvoice(
  bot: Bot,
  userId: number,
  plan: PlanId,
): Promise<string> {
  const p = PLANS[plan];
  return bot.api.createInvoiceLink(
    p.title,
    `${p.label} — реал-тайм алерты, smart-money списки, новые jetton-листинги`,
    JSON.stringify({ plan, uid: userId }), // payload (<= 128 байт)
    "", // provider_token: ПУСТО для Stars
    "XTR", // валюта Telegram Stars
    [{ label: p.label, amount: p.stars }],
    { subscription_period: SUBSCRIPTION_PERIOD },
  );
}

/** Разовая покупка (например, «пак smart-money списков»). */
export async function createOneTimeInvoice(
  bot: Bot,
  userId: number,
  opts: { title: string; description: string; stars: number; sku: string },
): Promise<string> {
  return bot.api.createInvoiceLink(
    opts.title,
    opts.description,
    JSON.stringify({ sku: opts.sku, uid: userId }),
    "",
    "XTR",
    [{ label: opts.title, amount: opts.stars }],
  );
}

/** Возврат звёзд (например, по запросу/спору). */
export async function refundPayment(bot: Bot, userId: number, chargeId: string) {
  return bot.api.refundStarPayment(userId, chargeId);
}

/**
 * Отмена авто-продления подписки (звёзды за текущий период не возвращаются).
 * Имя метода — editUserStarSubscription(user_id, charge_id, is_canceled) —
 * сверьте с вашей версией grammy/Bot API.
 */
export async function cancelSubscription(bot: Bot, userId: number, chargeId: string) {
  // editUserStarSubscription(user_id, telegram_payment_charge_id, is_canceled)
  return bot.api.editUserStarSubscription(userId, chargeId, true);
}

/** Регистрирует обработчики платёжного цикла Stars. */
export function registerPayments(bot: Bot, repo: Repo): void {
  // 1) pre_checkout_query — ОБЯЗАТЕЛЬНО ответить в течение 10 секунд, иначе платёж отклонится.
  bot.on("pre_checkout_query", async (ctx) => {
    try {
      // Здесь можно провалидировать payload / наличие "товара".
      JSON.parse(ctx.preCheckoutQuery.invoice_payload);
      await ctx.answerPreCheckoutQuery(true);
    } catch (e) {
      logger.warn("pre_checkout reject", String(e));
      await ctx.answerPreCheckoutQuery(false, "Не удалось обработать платёж, попробуйте ещё раз.");
    }
  });

  // 2) successful_payment — приходит и на первую оплату, и на каждое авто-продление.
  bot.on("message:successful_payment", async (ctx) => {
    const sp = ctx.message.successful_payment;
    let payload: { plan?: PlanId; sku?: string; uid: number };
    try {
      payload = JSON.parse(sp.invoice_payload);
    } catch {
      logger.warn("bad invoice_payload", sp.invoice_payload);
      return;
    }

    // Разовая покупка
    if (payload.sku) {
      // TODO: выдать SKU (например, разблокировать пак списков)
      await ctx.reply("✅ Покупка завершена, спасибо!");
      return;
    }

    // Подписка
    if (payload.plan && PLANS[payload.plan]) {
      await repo.activateSubscription({
        tgId: ctx.from!.id,
        plan: payload.plan,
        chargeId: sp.telegram_payment_charge_id,
        // поля подписки приходят только для рекуррентных инвойсов
        expiresAt: (sp as any).subscription_expiration_date ?? null,
        isRecurring: (sp as any).is_recurring ?? false,
        amountStars: sp.total_amount,
        period: SUBSCRIPTION_PERIOD,
      });
      await ctx.reply(
        `✅ ${PLANS[payload.plan].title} активирован!\n` +
          `Реал-тайм алерты и smart-money списки включены. Управление — в настройках Mini App.`,
      );
    }
  });
}
