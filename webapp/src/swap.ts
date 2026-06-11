import { StonApiClient } from "@ston-fi/api";
import { dexFactory, Client } from "@ston-fi/sdk";

// TON-сторона свопа на STON.fi — это pTON (proxy TON). У разных пулов разная версия pTON,
// поэтому пробуем обе (адреса мастеров из /v1/routers). Какая сработает — у той и берём пул;
// router из ответа simulate несёт правильный pTON для построения транзакции.
const PTON_MASTERS = [
  "EQBnGWMCf3-FZZq1W4IWcWiGAc3PHuZ0_H-7sad2oY00o83S", // v2 (большинство новых пулов)
  "EQCM3B12QK1e4yZSf8GtBRT0aLMNyEsBc_DhVfRRtOEffLez", // v1
];

const stonApi = new StonApiClient();
// SDK при сборке tx запрашивает состояние контрактов → нужен TON RPC.
// Публичный toncenter ок для MVP; при росте — свой ключ/эндпоинт.
const tonClient = new Client({ endpoint: "https://toncenter.com/api/v2/jsonRPC" });

export type SimResult = Awaited<ReturnType<StonApiClient["simulateSwap"]>>;

export interface SwapQuote {
  offerUnits: string; // потраченные нано-TON
  askUnits: string; // ожидаемый выход (сырые единицы jetton)
  minAskUnits: string; // минимум с учётом слиппеджа
  priceImpact: string; // доля (0.001 = 0.1%)
  feePercent: string;
  askAddress: string;
  router: SimResult["router"];
}

/** Котировка: сколько jetton получим за amountTon TON (с учётом слиппеджа). */
export async function quoteTonToJetton(
  jetton: string,
  amountTon: number,
  slippage = "0.01",
): Promise<SwapQuote> {
  const offerUnits = BigInt(Math.floor(amountTon * 1e9)).toString();
  let lastErr: unknown;
  for (const pton of PTON_MASTERS) {
    try {
      const sim = await stonApi.simulateSwap({
        offerAddress: pton,
        askAddress: jetton,
        offerUnits,
        slippageTolerance: slippage,
      });
      return {
        offerUnits: sim.offerUnits,
        askUnits: sim.askUnits,
        minAskUnits: sim.minAskUnits,
        priceImpact: sim.priceImpact,
        feePercent: sim.feePercent,
        askAddress: sim.askAddress,
        router: sim.router,
      };
    } catch (e) {
      lastErr = e; // нет пула под этой версией pTON — пробуем следующую
    }
  }
  throw lastErr ?? new Error("Нет пула STON.fi для этого токена");
}

export interface TxMessage {
  address: string;
  amount: string;
  payload?: string;
}

/** Строит сообщение для TonConnect.sendTransaction по котировке. */
export async function buildTonToJettonTx(userAddress: string, q: SwapQuote): Promise<TxMessage> {
  const dex = dexFactory(q.router);
  const router = tonClient.open(dex.Router.create(q.router.address));
  const proxyTon = dex.pTON.create(q.router.ptonMasterAddress);

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
    offerAmount: q.offerUnits,
    askJettonAddress: q.askAddress,
    minAskAmount: q.minAskUnits,
  });

  return {
    address: tx.to.toString(),
    amount: tx.value.toString(),
    payload: tx.body?.toBoc().toString("base64"),
  };
}
