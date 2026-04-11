import { RestClientV5, type OrderParamsV5 } from 'bybit-api';
import type { TradeSide, OrderType } from '@/types';
import { extractErrorMessage } from '@/lib/utils/retry';

type BybitConfig = {
  apiKey: string;
  apiSecret: string;
};

type OrderResult = {
  orderId: string;
  quantity: string;
};

async function bybitCall<T>(fn: () => Promise<T>, context: string): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    throw new Error(`[${context}] ${extractErrorMessage(err)}`);
  }
}

export function createBybitClient(config: BybitConfig): RestClientV5 {
  const baseUrl = process.env.BYBIT_BASE_URL;

  return new RestClientV5({
    key: config.apiKey,
    secret: config.apiSecret,
    testnet: false,
    demoTrading: true,
    ...(baseUrl ? { baseUrl } : {}),
  });
}

export async function getWalletBalance(client: RestClientV5): Promise<number> {
  const response = await bybitCall(
    () => client.getWalletBalance({ accountType: 'UNIFIED' }),
    'getWalletBalance',
  );

  if (response.retCode !== 0) {
    throw new Error(`Failed to get balance: ${response.retMsg}`);
  }

  const account = response.result.list[0];
  if (!account) {
    throw new Error('No account found');
  }

  // In Unified Trading Account (UTA), totalAvailableBalance is the total
  // margin available across all coins — this is what determines position sizing.
  const rawBalance = account.totalAvailableBalance || '0';
  const balance = parseFloat(rawBalance);

  if (isNaN(balance) || balance <= 0) {
    throw new Error(
      `Insufficient balance (got: ${rawBalance}). Make sure the demo account has funds.`,
    );
  }

  return balance;
}

export async function setLeverage(
  client: RestClientV5,
  symbol: string,
  leverage: number,
): Promise<void> {
  const response = await bybitCall(
    () => client.setLeverage({
      category: 'linear',
      symbol,
      buyLeverage: String(leverage),
      sellLeverage: String(leverage),
    }),
    'setLeverage',
  );

  // 110043 = leverage not modified (already set to this value)
  if (response.retCode !== 0 && response.retCode !== 110043) {
    console.warn('[bybit] setLeverage warning:', response.retCode, response.retMsg);
  }
}

export async function getSymbolInfo(
  client: RestClientV5,
  symbol: string,
): Promise<{ minQty: number; qtyStep: number; tickSize: number }> {
  const response = await bybitCall(
    () => client.getInstrumentsInfo({
      category: 'linear',
      symbol,
    }),
    'getSymbolInfo',
  );

  if (response.retCode !== 0) {
    throw new Error(`Symbol not found: ${response.retMsg}`);
  }

  const instrument = response.result.list[0];
  if (!instrument) {
    throw new Error(`Symbol ${symbol} not found`);
  }

  const lotFilter = instrument.lotSizeFilter;
  const priceFilter = instrument.priceFilter;

  return {
    minQty: parseFloat(lotFilter?.minOrderQty ?? '0.001'),
    qtyStep: parseFloat(lotFilter?.qtyStep ?? '0.001'),
    tickSize: parseFloat(priceFilter?.tickSize ?? '0.01'),
  };
}

export async function getLastPrice(
  client: RestClientV5,
  symbol: string,
): Promise<number> {
  const response = await bybitCall(
    () => client.getTickers({ category: 'linear', symbol }),
    'getLastPrice',
  );

  if (response.retCode !== 0) {
    throw new Error(`Failed to get price: ${response.retMsg}`);
  }

  const ticker = response.result.list[0];
  if (!ticker) {
    throw new Error(`No ticker data for ${symbol}`);
  }

  return parseFloat(ticker.lastPrice);
}

function stepPrecision(step: number): number {
  const s = step.toString();
  if (!s.includes('.')) return 0;
  return s.split('.')[1]?.length ?? 0;
}

function roundToStep(value: number, step: number): string {
  const precision = stepPrecision(step);
  const rounded = Math.floor(value / step) * step;
  return rounded.toFixed(precision);
}

function roundPriceToTick(price: number, tickSize: number): string {
  const precision = stepPrecision(tickSize);
  const rounded = Math.round(price / tickSize) * tickSize;
  return rounded.toFixed(precision);
}

export function calculatePositionSize(params: {
  balance: number;
  riskType: 'percent' | 'amount';
  riskPercent?: number | null;
  riskAmountUsd?: number;
  leverage: number;
  entryPrice: number;
  stopLoss?: number;
  side: TradeSide;
  qtyStep: number;
  minQty: number;
}): string {
  const { balance, riskType, leverage, entryPrice, stopLoss, side, qtyStep, minQty } = params;

  const riskUsd = riskType === 'percent'
    ? balance * ((params.riskPercent ?? 1) / 100)
    : (params.riskAmountUsd ?? 100);

  let positionSizeUsd: number;

  if (stopLoss !== undefined && stopLoss > 0) {
    const slDistance =
      side === 'Buy'
        ? Math.abs(entryPrice - stopLoss)
        : Math.abs(stopLoss - entryPrice);

    if (slDistance <= 0) {
      throw new Error('Stop loss distance must be positive');
    }

    const slPercent = slDistance / entryPrice;
    positionSizeUsd = riskUsd / slPercent;
  } else {
    positionSizeUsd = riskUsd * leverage;
  }

  const quantity = positionSizeUsd / entryPrice;
  const rounded = roundToStep(quantity, qtyStep);
  const roundedNum = parseFloat(rounded);

  if (roundedNum < minQty) {
    throw new Error(
      `Calculated qty ${rounded} below min ${minQty}. Risk: $${riskUsd.toFixed(2)}`,
    );
  }

  return rounded;
}

export async function placeOrder(
  client: RestClientV5,
  params: {
    symbol: string;
    side: TradeSide;
    orderType: OrderType;
    quantity: string;
    entryPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
    tickSize: number;
  },
): Promise<OrderResult> {
  const orderParams: OrderParamsV5 = {
    category: 'linear',
    symbol: params.symbol,
    side: params.side,
    orderType: params.orderType,
    qty: params.quantity,
  };

  if (params.orderType === 'Limit' && params.entryPrice !== undefined) {
    orderParams.price = roundPriceToTick(params.entryPrice, params.tickSize);
    orderParams.timeInForce = 'GTC';
  }

  if (params.stopLoss !== undefined && params.stopLoss > 0) {
    orderParams.stopLoss = roundPriceToTick(params.stopLoss, params.tickSize);
  }

  if (params.takeProfit !== undefined && params.takeProfit > 0) {
    orderParams.takeProfit = roundPriceToTick(params.takeProfit, params.tickSize);
  }

  console.log('[bybit] Submitting order:', JSON.stringify(orderParams));

  const response = await bybitCall(
    () => client.submitOrder(orderParams),
    'placeOrder',
  );

  if (response.retCode !== 0) {
    throw new Error(`Order failed: ${response.retMsg} (code: ${response.retCode})`);
  }

  return {
    orderId: response.result.orderId,
    quantity: orderParams.qty,
  };
}

// ── Positions ──

export type PositionInfo = {
  symbol: string;
  side: string;
  size: string;
  entryPrice: string;
  markPrice: string;
  unrealisedPnl: string;
  leverage: string;
  liqPrice: string;
  takeProfit: string;
  stopLoss: string;
  positionIdx: 0 | 1 | 2;
};

export async function getPositions(
  client: RestClientV5,
  symbol?: string,
): Promise<ReadonlyArray<PositionInfo>> {
  const params = {
    category: 'linear' as const,
    settleCoin: 'USDT',
    ...(symbol ? { symbol } : {}),
  };

  const response = await bybitCall(
    () => client.getPositionInfo(params),
    'getPositions',
  );

  if (response.retCode !== 0) {
    throw new Error(`Failed to get positions: ${response.retMsg}`);
  }

  return (response.result.list ?? [])
    .filter((p) => parseFloat(String(p.size ?? '0')) > 0)
    .map((p) => ({
      symbol: String(p.symbol ?? ''),
      side: String(p.side ?? ''),
      size: String(p.size ?? '0'),
      entryPrice: String(p.avgPrice ?? '0'),
      markPrice: String(p.markPrice ?? '0'),
      unrealisedPnl: String(p.unrealisedPnl ?? '0'),
      leverage: String(p.leverage ?? '0'),
      liqPrice: String(p.liqPrice ?? '0'),
      takeProfit: String(p.takeProfit ?? ''),
      stopLoss: String(p.stopLoss ?? ''),
      positionIdx: (Number(p.positionIdx ?? 0) as 0 | 1 | 2),
    }));
}

export async function closePosition(
  client: RestClientV5,
  params: { symbol: string; side: string; size: string },
): Promise<string> {
  const closeSide = params.side === 'Buy' ? 'Sell' : 'Buy';

  const response = await bybitCall(
    () => client.submitOrder({
      category: 'linear',
      symbol: params.symbol,
      side: closeSide,
      orderType: 'Market',
      qty: params.size,
      reduceOnly: true,
    }),
    'closePosition',
  );

  if (response.retCode !== 0) {
    throw new Error(`Close failed: ${response.retMsg}`);
  }

  return response.result.orderId;
}

// ── Open Orders ──

export type OpenOrderInfo = {
  orderId: string;
  symbol: string;
  side: string;
  orderType: string;
  price: string;
  qty: string;
  leavesQty: string;
  cumExecQty: string;
  stopLoss: string;
  takeProfit: string;
  createdTime: string;
  orderStatus: string;
};

export async function getOpenOrders(
  client: RestClientV5,
  symbol?: string,
): Promise<ReadonlyArray<OpenOrderInfo>> {
  const params = {
    category: 'linear' as const,
    settleCoin: 'USDT',
    ...(symbol ? { symbol } : {}),
  };

  const response = await bybitCall(
    () => client.getActiveOrders(params),
    'getOpenOrders',
  );

  if (response.retCode !== 0) {
    throw new Error(`Failed to get orders: ${response.retMsg}`);
  }

  return (response.result.list ?? []).map((o) => ({
    orderId: String(o.orderId ?? ''),
    symbol: String(o.symbol ?? ''),
    side: String(o.side ?? ''),
    orderType: String(o.orderType ?? ''),
    price: String(o.price ?? '0'),
    qty: String(o.qty ?? '0'),
    leavesQty: String(o.leavesQty ?? '0'),
    cumExecQty: String(o.cumExecQty ?? '0'),
    stopLoss: String(o.stopLoss ?? ''),
    takeProfit: String(o.takeProfit ?? ''),
    createdTime: String(o.createdTime ?? ''),
    orderStatus: String(o.orderStatus ?? ''),
  }));
}

export async function setPositionTpSl(
  client: RestClientV5,
  params: {
    symbol: string;
    positionIdx: 0 | 1 | 2;
    stopLoss?: string;
    takeProfit?: string;
  },
): Promise<void> {
  const response = await bybitCall(
    () => client.setTradingStop({
      category: 'linear',
      symbol: params.symbol,
      positionIdx: params.positionIdx,
      ...(params.stopLoss !== undefined ? { stopLoss: params.stopLoss } : {}),
      ...(params.takeProfit !== undefined ? { takeProfit: params.takeProfit } : {}),
    }),
    'setPositionTpSl',
  );

  if (response.retCode !== 0) {
    throw new Error(`Set TP/SL failed: ${response.retMsg} (code: ${response.retCode})`);
  }
}

export async function amendOpenOrder(
  client: RestClientV5,
  params: {
    symbol: string;
    orderId: string;
    qty?: string;
    price?: string;
    stopLoss?: string;
    takeProfit?: string;
  },
): Promise<void> {
  const response = await bybitCall(
    () => client.amendOrder({
      category: 'linear',
      symbol: params.symbol,
      orderId: params.orderId,
      ...(params.qty !== undefined ? { qty: params.qty } : {}),
      ...(params.price !== undefined ? { price: params.price } : {}),
      ...(params.stopLoss !== undefined ? { stopLoss: params.stopLoss } : {}),
      ...(params.takeProfit !== undefined ? { takeProfit: params.takeProfit } : {}),
    }),
    'amendOrder',
  );

  if (response.retCode !== 0) {
    throw new Error(`Amend order failed: ${response.retMsg} (code: ${response.retCode})`);
  }
}

export async function cancelOrder(
  client: RestClientV5,
  params: { symbol: string; orderId: string },
): Promise<void> {
  const response = await bybitCall(
    () => client.cancelOrder({
      category: 'linear',
      symbol: params.symbol,
      orderId: params.orderId,
    }),
    'cancelOrder',
  );

  if (response.retCode !== 0) {
    throw new Error(`Cancel failed: ${response.retMsg}`);
  }
}

export async function cancelAllOrders(
  client: RestClientV5,
  symbol?: string,
): Promise<void> {
  const params = {
    category: 'linear' as const,
    ...(symbol ? { symbol } : { settleCoin: 'USDT' }),
  };

  const response = await bybitCall(
    () => client.cancelAllOrders(params),
    'cancelAllOrders',
  );

  if (response.retCode !== 0) {
    throw new Error(`Cancel all failed: ${response.retMsg}`);
  }
}
