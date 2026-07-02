// Единый фасад свопа для TonSonar.
//
// ПЕРВИЧНО — Omniston-роутинг STON.fi (omniston.ts): RFQ-агрегатор, лучшая цена по
// множеству резолверов/DEX'ов TON. Если Omniston не даёт маршрут (нет резолвера под
// токен / отказ WebSocket) — ФОЛБЭК на прямой своп по пулу STON.fi через @ston-fi/sdk
// (проверенный путь, был у нас до Omniston). App.tsx работает только с этим фасадом.
import { StonApiClient } from "@ston-fi/api";
import { dexFactory, Client } from "@ston-fi/sdk";
import { openOmnistonQuote, buildOmnistonTx } from "./omniston";
import type { QuoteSession, TxMessage } from "./omniston";

export type { TxMessage } from "./omniston";

type SimResult = Awaited<ReturnType<StonApiClient["simulateSwap"]>>;

// Унифицированная котировка. provider — как строить транзакцию; via — что показать в UI.
export interface SwapQuote {
  provider: "omniston" | "stonfi";
  via: string; // «Omniston · <resolver>» либо «STON.fi»
  outUnits: string; // ожидаемый выход (сырые единицы jetton)
  minOutUnits: string; // минимум с учётом слиппеджа
  priceImpact?: string; // доля (0.001 = 0.1%); только прямой STON.fi
  // Непрозрачные данные для сборки транзакции:
  omniQuoteId?: string; // provider === "omniston"
  ston?: { offerUnits: string; askAddress: string; router: SimResult["router"] }; // provider === "stonfi"
}

const DEFAULT_SLIPPAGE = 0.01; // 1%

// --- Прямой STON.fi (фолбэк) -------------------------------------------------
// TON-сторона свопа на STON.fi — pTON (proxy TON). У разных пулов разная версия pTON,
// пробуем обе (мастера из /v1/routers); router из ответа simulate несёт правильный pTON.
const PTON_MASTERS = [
  "EQBnGWMCf3-FZZq1W4IWcWiGAc3PHuZ0_H-7sad2oY00o83S", // v2 (большинство новых пулов)
  "EQCM3B12QK1e4yZSf8GtBRT0aLMNyEsBc_DhVfRRtOEffLez", // v1
];

const stonApi = new StonApiClient();
// SDK при сборке tx запрашивает состояние контрактов → нужен TON RPC.
const tonClient = new Client({ endpoint: "https://toncenter.com/api/v2/jsonRPC" });

async function quoteStonfiDirect(jetton: string, amountTon: number, slippage = DEFAULT_SLIPPAGE): Promise<SwapQuote> {
  const offerUnits = BigInt(Math.floor(amountTon * 1e9)).toString();
  let lastErr: unknown;
  for (const pton of PTON_MASTERS) {
    try {
      const sim = await stonApi.simulateSwap({
        offerAddress: pton,
        askAddress: jetton,
        offerUnits,
        slippageTolerance: String(slippage),
      });
      return {
        provider: "stonfi",
        via: "STON.fi",
        outUnits: sim.askUnits,
        minOutUnits: sim.minAskUnits,
        priceImpact: sim.priceImpact,
        ston: { offerUnits: sim.offerUnits, askAddress: sim.askAddress, router: sim.router },
      };
    } catch (e) {
      lastErr = e; // нет пула под этой версией pTON — пробуем следующую
    }
  }
  throw lastErr ?? new Error("Нет пула STON.fi для этого токена");
}

async function buildStonfiTx(userAddress: string, q: SwapQuote): Promise<TxMessage[]> {
  if (!q.ston) throw new Error("stonfi quote data missing");
  const dex = dexFactory(q.ston.router);
  const router = tonClient.open(dex.Router.create(q.ston.router.address));
  const proxyTon = dex.pTON.create(q.ston.router.ptonMasterAddress);

  // Метод есть у всех версий роутера; сужаем тип, чтобы не воевать с union.
  const tx = await (
    router as unknown as {
      getSwapTonToJettonTxParams(params: {
        userWalletAddress: string;
        proxyTon: unknown;
        offerAmount: string;
        askJettonAddress: string;
        minAskAmount: string;
      }): Promise<{ to: { toString(): string }; value: bigint; body?: { toBoc(): { toString(enc: string): string } } }>;
    }
  ).getSwapTonToJettonTxParams({
    userWalletAddress: userAddress,
    proxyTon,
    offerAmount: q.ston.offerUnits,
    askJettonAddress: q.ston.askAddress,
    minAskAmount: q.minOutUnits,
  });

  return [{ address: tx.to.toString(), amount: tx.value.toString(), payload: tx.body?.toBoc().toString("base64") }];
}

// --- Публичный фасад ---------------------------------------------------------

/**
 * Открывает поток котировок TON→jetton. Сначала пробует Omniston (живой RFQ-стрим);
 * если маршрута нет — один раз откатывается на прямой STON.fi. onQuote зовётся на
 * каждую свежую котировку, onError — когда не сработал ни один путь. Возвращает
 * сессию: вызывающий обязан вызвать close() при закрытии панели/смене токена.
 */
export function openQuote(
  jetton: string,
  amountTon: number,
  onQuote: (q: SwapQuote) => void,
  onError: (e: unknown) => void,
  slippage = DEFAULT_SLIPPAGE,
): QuoteSession {
  let usedFallback = false;
  const session = openOmnistonQuote(
    jetton,
    amountTon,
    slippage,
    (oq) =>
      onQuote({
        provider: "omniston",
        via: oq.resolverName ? `Omniston · ${oq.resolverName}` : "Omniston",
        outUnits: oq.outUnits,
        minOutUnits: oq.minOutUnits,
        omniQuoteId: oq.quoteId,
      }),
    () => {
      // Omniston без маршрута → один прямой запрос к STON.fi.
      if (usedFallback) return;
      usedFallback = true;
      session.close(); // закрываем RFQ-подписку, дальше живём на прямой котировке
      quoteStonfiDirect(jetton, amountTon, slippage).then(onQuote).catch(onError);
    },
  );
  return session;
}

/** Строит сообщения для TonConnect по унифицированной котировке. */
export function buildSwapTx(userAddress: string, q: SwapQuote): Promise<TxMessage[]> {
  if (q.provider === "omniston") {
    if (!q.omniQuoteId) throw new Error("omniston quote id missing");
    return buildOmnistonTx(userAddress, q.omniQuoteId);
  }
  return buildStonfiTx(userAddress, q);
}
