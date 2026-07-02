// Omniston-роутинг STON.fi — RFQ-агрегатор ликвидности TON. Вместо прямого свопа
// по конкретному пулу STON.fi (см. swap.ts, фолбэк) Omniston собирает котировки от
// множества резолверов/DEX'ов и отдаёт лучшую цену исполнения. Именно этот флоу
// STON.fi продвигает билдерам (спотлайты @stonfidex).
//
// Поток: new Omniston({ apiUrl }) → requestForQuote (WebSocket-стрим котировок,
// каждая новая перебивает прошлую/истёкшую) → tonBuildSwap(quoteId) → сообщения
// для TON Connect. WebSocket в браузере нативный; Buffer/global полифиллит vite.
import { Omniston } from "@ston-fi/omniston-sdk";
import type { AssetId, ChainAddress, QuoteRequest } from "@ston-fi/omniston-sdk";

const OMNISTON_WS = "wss://omni-ws.ston.fi";

// Один клиент на всё приложение (ленивый — WebSocket поднимается при первом запросе).
let _client: Omniston | null = null;
function client(): Omniston {
  return (_client ??= new Omniston({ apiUrl: OMNISTON_WS }));
}

const TON_NATIVE: AssetId = { chain: { $case: "ton", value: { kind: { $case: "native", value: {} } } } };
const jettonAsset = (addr: string): AssetId => ({
  chain: { $case: "ton", value: { kind: { $case: "jetton", value: addr } } },
});
const tonChainAddress = (addr: string): ChainAddress => ({ chain: { $case: "ton", value: addr } });

export interface OmniQuote {
  quoteId: string;
  resolverName: string; // кто дал лучшую котировку (для UI «via Omniston · X»)
  outUnits: string; // ожидаемый выход (сырые единицы jetton)
  minOutUnits: string; // минимум с учётом слиппеджа
}

export interface QuoteSession {
  close(): void;
}

/**
 * Открывает RFQ-стрим: подписывается на живые котировки Omniston (TON→jetton) и
 * зовёт onQuote на каждую свежую. Подписку держим открытой, пока панель свопа жива —
 * так на момент нажатия «Обменять» у нас всегда актуальный quoteId. onNoQuote —
 * когда Omniston не нашёл маршрут (вызывающий откатывается на прямой своп STON.fi).
 */
export function openOmnistonQuote(
  jetton: string,
  amountTon: number,
  slippage: number, // доля, 0.01 = 1%
  onQuote: (q: OmniQuote) => void,
  onNoQuote: (e: unknown) => void,
): QuoteSession {
  const offerUnits = BigInt(Math.floor(amountTon * 1e9)).toString();
  const maxPriceSlippagePips = Math.round(slippage * 1_000_000); // 0.01 → 10000

  const request: QuoteRequest = {
    inputAsset: TON_NATIVE,
    outputAsset: jettonAsset(jetton),
    amount: { $case: "inputUnits", value: offerUnits },
    settlementParams: [{ params: { $case: "swap", value: { maxPriceSlippagePips } } }],
  };

  const sub = client()
    .requestForQuote(request)
    .subscribe({
      next(event) {
        if (!event) return; // null = котировки истекли и новых нет
        if (event.$case === "quoteUpdated") {
          const q = event.value;
          if (q.settlementData.$case !== "swap") return; // нас интересует только swap-settlement
          onQuote({
            quoteId: q.quoteId,
            resolverName: q.resolverName,
            outUnits: q.outputUnits,
            minOutUnits: q.settlementData.value.minOutputAmount,
          });
        } else if (event.$case === "noQuote") {
          onNoQuote(new Error("omniston: no route"));
        }
      },
      error: onNoQuote,
    });

  return { close: () => sub.unsubscribe() };
}

export interface TxMessage {
  address: string;
  amount: string;
  payload?: string;
  stateInit?: string;
}

/** Строит сообщения для TonConnect.sendTransaction по выбранной котировке Omniston. */
export async function buildOmnistonTx(userAddress: string, quoteId: string): Promise<TxMessage[]> {
  // Для TON→jetton все адреса = кошелёк юзера (он и платит, и получает jetton, и
  // возврат/сдача газа туда же). Живой API требует их явно, не подставляет дефолт.
  const self = tonChainAddress(userAddress);
  const tx = await client().tonBuildSwap({
    quoteId,
    transferSrcAddress: self,
    traderDstAddress: self,
    gasExcessAddress: self,
    refundSrcAddress: self,
  });
  // Omniston отдаёт payload/stateInit как hex BoC; TON Connect ждёт base64 BoC.
  return tx.messages.map((m) => ({
    address: m.targetAddress,
    amount: m.sendAmount,
    payload: hexToBase64(m.payload),
    stateInit: m.jettonWalletStateInit ? hexToBase64(m.jettonWalletStateInit) : undefined,
  }));
}

// hex → base64 без зависимости от Buffer (одни и те же байты BoC, меняется только кодировка).
function hexToBase64(hex: string): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
