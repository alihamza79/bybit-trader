import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import {
  createBybitClient,
  getOpenOrders,
  cancelOrder,
  cancelAllOrders,
  amendOpenOrder,
  getSymbolInfo,
  calculatePositionSize,
  getWalletBalance,
} from '@/lib/bybit';
import { delay } from '@/lib/utils/delay';
import { withRetry, extractErrorMessage } from '@/lib/utils/retry';
import { verifyProxy, verifyAccountProxies } from '@/lib/utils/proxy-check';
import { TRADE_DELAY_MS } from '@/config/constants';

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: accounts, error } = await supabase
      .from('bybit_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const proxyFailures = await verifyAccountProxies(accounts ?? []);

    const allOrders: Array<{
      account_id: string;
      account_name: string;
      orders: Awaited<ReturnType<typeof getOpenOrders>>;
      error?: string;
    }> = [];

    for (let i = 0; i < (accounts?.length ?? 0); i++) {
      const account = accounts![i];
      if (i > 0) await delay(TRADE_DELAY_MS);

      const proxyError = proxyFailures.get(account.id);
      if (proxyError) {
        allOrders.push({
          account_id: account.id,
          account_name: account.name,
          orders: [],
          error: proxyError,
        });
        continue;
      }

      try {
        const client = createBybitClient({
          apiKey: account.api_key,
          apiSecret: account.api_secret,
          proxyUrl: account.proxy_url,
        });

        const orders = await withRetry(() => getOpenOrders(client), 2, 500);
        allOrders.push({
          account_id: account.id,
          account_name: account.name,
          orders,
        });
      } catch (err: unknown) {
        const errorMsg = extractErrorMessage(err);
        console.error(`[orders] Failed for ${account.name}:`, errorMsg);
        allOrders.push({
          account_id: account.id,
          account_name: account.name,
          orders: [],
          error: errorMsg,
        });
      }
    }

    return NextResponse.json(allOrders);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as {
      account_id: string;
      symbol: string;
      order_id: string;
      qty?: string;
      price?: string;
      stop_loss?: string;
      take_profit?: string;
      sync_risk?: boolean;
      order_price?: string;
      order_side?: string;
      order_sl?: string;
    };

    if (!body.order_id) {
      return NextResponse.json({ error: 'order_id is required' }, { status: 400 });
    }

    const { data: account, error } = await supabase
      .from('bybit_accounts')
      .select('*')
      .eq('id', body.account_id)
      .eq('user_id', user.id)
      .single();

    if (error || !account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    if (account.proxy_url) {
      const proxyCheck = await verifyProxy(account.proxy_url);
      if (!proxyCheck.ok) {
        return NextResponse.json({ error: proxyCheck.error }, { status: 400 });
      }
    }

    const client = createBybitClient({
      apiKey: account.api_key,
      apiSecret: account.api_secret,
      proxyUrl: account.proxy_url,
    });

    let syncedQty: string | undefined;

    if (body.sync_risk && body.order_side) {
      let entryPrice: number | undefined;
      let slPrice: number | undefined;

      if (body.price) {
        entryPrice = parseFloat(body.price);
      } else if (body.order_price) {
        entryPrice = parseFloat(body.order_price);
      }

      if (body.stop_loss) {
        slPrice = parseFloat(body.stop_loss);
      } else if (body.order_sl) {
        slPrice = parseFloat(body.order_sl);
      }

      if (entryPrice && entryPrice > 0 && slPrice && slPrice > 0) {
        const [walletInfo, symbolInfo] = await withRetry(() =>
          Promise.all([
            getWalletBalance(client),
            getSymbolInfo(client, body.symbol),
          ]),
        );
        const balance = walletInfo.availableBalance;

        const riskType = (account.risk_type as 'percent' | 'amount') || 'amount';

        syncedQty = calculatePositionSize({
          balance,
          riskType,
          riskPercent: account.risk_percent,
          riskAmountUsd: account.risk_amount,
          leverage: 1,
          entryPrice,
          stopLoss: slPrice,
          side: body.order_side as 'Buy' | 'Sell',
          qtyStep: symbolInfo.qtyStep,
          minQty: symbolInfo.minQty,
        });
      }
    }

    await withRetry(() => amendOpenOrder(client, {
      symbol: body.symbol,
      orderId: body.order_id,
      qty: syncedQty ?? body.qty,
      price: body.price,
      stopLoss: body.stop_loss,
      takeProfit: body.take_profit,
    }));

    return NextResponse.json({ success: true, synced_qty: syncedQty });
  } catch (err: unknown) {
    return NextResponse.json({ error: extractErrorMessage(err) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as {
      account_id: string;
      symbol: string;
      order_id?: string;
      cancel_all?: boolean;
    };

    const { data: account, error } = await supabase
      .from('bybit_accounts')
      .select('*')
      .eq('id', body.account_id)
      .eq('user_id', user.id)
      .single();

    if (error || !account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    if (account.proxy_url) {
      const proxyCheck = await verifyProxy(account.proxy_url);
      if (!proxyCheck.ok) {
        return NextResponse.json({ error: proxyCheck.error }, { status: 400 });
      }
    }

    const client = createBybitClient({
      apiKey: account.api_key,
      apiSecret: account.api_secret,
      proxyUrl: account.proxy_url,
    });

    if (body.cancel_all) {
      await withRetry(() => cancelAllOrders(client, body.symbol));
    } else if (body.order_id) {
      const orderId = body.order_id;
      await withRetry(() => cancelOrder(client, { symbol: body.symbol, orderId }));
    } else {
      return NextResponse.json({ error: 'order_id or cancel_all required' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: extractErrorMessage(err) }, { status: 500 });
  }
}
