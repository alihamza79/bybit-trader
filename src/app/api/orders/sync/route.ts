import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import {
  createBybitClient,
  cancelOrder,
  amendOpenOrder,
  getSymbolInfo,
  calculatePositionSize,
  getWalletBalance,
  getOpenOrders,
} from '@/lib/bybit';
import type { OpenOrderInfo } from '@/lib/bybit';
import { delay } from '@/lib/utils/delay';
import { withRetry, extractErrorMessage } from '@/lib/utils/retry';
import { verifyAccountProxies } from '@/lib/utils/proxy-check';
import { TRADE_DELAY_MS } from '@/config/constants';

type OrderFingerprint = {
  symbol: string;
  side: string;
  price: string;
  stop_loss: string;
  take_profit: string;
};

type SyncCancelBody = {
  action: 'cancel';
  source_account_id: string;
  source_order_id: string;
  match: OrderFingerprint;
};

type SyncAmendBody = {
  action: 'amend';
  source_account_id: string;
  source_order_id: string;
  match: OrderFingerprint;
  price?: string;
  stop_loss?: string;
  take_profit?: string;
  sync_qty_to_risk: boolean;
};

type SyncBody = SyncCancelBody | SyncAmendBody;

type SyncResult = {
  account_id: string;
  account_name: string;
  status: 'success' | 'failed';
  error?: string;
  synced_qty?: string;
};

function findMatchingOrder(
  orders: ReadonlyArray<OpenOrderInfo>,
  match: OrderFingerprint,
): OpenOrderInfo | undefined {
  return orders.find((o) =>
    o.symbol === match.symbol
    && o.side === match.side
    && o.price === match.price
    && o.stopLoss === match.stop_loss
    && o.takeProfit === match.take_profit,
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as SyncBody;

    if (!body.match?.symbol || !body.source_account_id) {
      return NextResponse.json({ error: 'match and source_account_id required' }, { status: 400 });
    }

    const { data: accounts, error } = await supabase
      .from('bybit_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (error || !accounts?.length) {
      return NextResponse.json({ error: 'No accounts found' }, { status: 404 });
    }

    const proxyFailures = await verifyAccountProxies(accounts);

    const results: SyncResult[] = [];
    const { match } = body;

    if (body.action === 'cancel') {
      for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        if (i > 0) await delay(TRADE_DELAY_MS);

        const proxyError = proxyFailures.get(account.id);
        if (proxyError) {
          results.push({ account_id: account.id, account_name: account.name, status: 'failed', error: proxyError });
          continue;
        }

        try {
          const client = createBybitClient({
            apiKey: account.api_key,
            apiSecret: account.api_secret,
            proxyUrl: account.proxy_url,
          });

          if (account.id === body.source_account_id) {
            await withRetry(() => cancelOrder(client, {
              symbol: match.symbol,
              orderId: body.source_order_id,
            }));
            results.push({ account_id: account.id, account_name: account.name, status: 'success' });
          } else {
            const orders = await withRetry(() => getOpenOrders(client, match.symbol));
            const matched = findMatchingOrder(orders, match);

            if (!matched) {
              results.push({
                account_id: account.id, account_name: account.name,
                status: 'success', error: 'No matching order found',
              });
              continue;
            }

            await withRetry(() => cancelOrder(client, {
              symbol: match.symbol,
              orderId: matched.orderId,
            }));
            results.push({ account_id: account.id, account_name: account.name, status: 'success' });
          }
        } catch (err: unknown) {
          results.push({
            account_id: account.id, account_name: account.name,
            status: 'failed', error: extractErrorMessage(err),
          });
        }
      }
    } else if (body.action === 'amend') {
      for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        if (i > 0) await delay(TRADE_DELAY_MS);

        const proxyError = proxyFailures.get(account.id);
        if (proxyError) {
          results.push({ account_id: account.id, account_name: account.name, status: 'failed', error: proxyError });
          continue;
        }

        try {
          const client = createBybitClient({
            apiKey: account.api_key,
            apiSecret: account.api_secret,
            proxyUrl: account.proxy_url,
          });

          let targetOrderId: string;
          let targetOrderPrice: string;

          if (account.id === body.source_account_id) {
            targetOrderId = body.source_order_id;
            targetOrderPrice = match.price;
          } else {
            const orders = await withRetry(() => getOpenOrders(client, match.symbol));
            const matched = findMatchingOrder(orders, match);

            if (!matched) {
              results.push({
                account_id: account.id, account_name: account.name,
                status: 'success', error: 'No matching order found',
              });
              continue;
            }
            targetOrderId = matched.orderId;
            targetOrderPrice = matched.price;
          }

          let syncedQty: string | undefined;
          const effectiveSl = body.stop_loss ?? match.stop_loss;
          const effectivePrice = body.price ?? targetOrderPrice;

          if (body.sync_qty_to_risk && effectiveSl && parseFloat(effectiveSl) > 0) {
            syncedQty = await calculateSyncedQty(
              client, account, match.symbol,
              parseFloat(effectivePrice),
              parseFloat(effectiveSl),
              match.side as 'Buy' | 'Sell',
            );
          }

          await withRetry(() => amendOpenOrder(client, {
            symbol: match.symbol,
            orderId: targetOrderId,
            price: body.price,
            stopLoss: body.stop_loss,
            takeProfit: body.take_profit,
            qty: syncedQty,
          }));
          results.push({
            account_id: account.id, account_name: account.name,
            status: 'success', synced_qty: syncedQty,
          });
        } catch (err: unknown) {
          results.push({
            account_id: account.id, account_name: account.name,
            status: 'failed', error: extractErrorMessage(err),
          });
        }
      }
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function calculateSyncedQty(
  client: ReturnType<typeof createBybitClient>,
  account: { risk_type: string | null; risk_percent: number | null; risk_amount: number },
  symbol: string,
  entryPrice: number,
  stopLoss: number,
  side: 'Buy' | 'Sell',
): Promise<string> {
  const [walletInfo, symbolInfo] = await withRetry(() =>
    Promise.all([
      getWalletBalance(client),
      getSymbolInfo(client, symbol),
    ]),
  );

  const riskType = (account.risk_type as 'percent' | 'amount') || 'amount';

  return calculatePositionSize({
    balance: walletInfo.availableBalance,
    riskType,
    riskPercent: account.risk_percent,
    riskAmountUsd: account.risk_amount,
    leverage: 1,
    entryPrice,
    stopLoss,
    side,
    qtyStep: symbolInfo.qtyStep,
    minQty: symbolInfo.minQty,
  });
}
