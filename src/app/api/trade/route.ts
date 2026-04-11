import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { tradeSchema } from '@/lib/validations/trade';
import {
  createBybitClient,
  getWalletBalance,
  setLeverage,
  getSymbolInfo,
  getLastPrice,
  calculatePositionSize,
  placeOrder,
} from '@/lib/bybit';
import { delay } from '@/lib/utils/delay';
import { withRetry, extractErrorMessage } from '@/lib/utils/retry';
import { TRADE_DELAY_MS } from '@/config/constants';
import type { AccountExecutionResult } from '@/types';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: unknown = await request.json();
    const parsed = tradeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { symbol, side, order_type, leverage, entry_price, stop_loss, take_profit, account_ids, risk_overrides } = parsed.data;

    let query = supabase
      .from('bybit_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (account_ids && account_ids.length > 0) {
      query = query.in('id', account_ids);
    }

    const { data: accounts, error: accountsError } = await query;

    if (accountsError) {
      return NextResponse.json({ error: accountsError.message }, { status: 500 });
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ error: 'No active accounts found' }, { status: 400 });
    }

    const { data: tradeLog, error: logError } = await supabase
      .from('trade_logs')
      .insert({
        user_id: user.id,
        symbol,
        side,
        order_type,
        leverage,
        entry_price: entry_price ?? null,
        stop_loss: stop_loss ?? null,
        take_profit: take_profit ?? null,
      })
      .select()
      .single();

    if (logError || !tradeLog) {
      return NextResponse.json({ error: 'Failed to create trade log' }, { status: 500 });
    }

    const results: AccountExecutionResult[] = [];

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];

      if (i > 0) {
        await delay(TRADE_DELAY_MS);
      }

      let result: AccountExecutionResult;
      let accountBalance: string | undefined;

      try {
        const client = createBybitClient({
          apiKey: account.api_key,
          apiSecret: account.api_secret,
        });

        const [walletInfo, symbolInfo, lastPrice] = await withRetry(() =>
          Promise.all([
            getWalletBalance(client),
            getSymbolInfo(client, symbol),
            getLastPrice(client, symbol),
          ]),
        );

        const balance = walletInfo.availableBalance;
        accountBalance = balance.toFixed(2);

        await withRetry(() => setLeverage(client, symbol, leverage));

        const priceForCalc = order_type === 'Limit' && entry_price !== undefined
          ? entry_price
          : lastPrice;

        const override = risk_overrides?.[account.id];
        const effectiveRiskType = override
          ? override.risk_type
          : ((account.risk_type as 'percent' | 'amount') || 'amount');
        const effectiveRiskPercent = override && override.risk_type === 'percent'
          ? override.risk_value
          : account.risk_percent;
        const effectiveRiskAmount = override && override.risk_type === 'amount'
          ? override.risk_value
          : account.risk_amount;

        const quantity = calculatePositionSize({
          balance,
          riskType: effectiveRiskType,
          riskPercent: effectiveRiskPercent,
          riskAmountUsd: effectiveRiskAmount,
          leverage,
          entryPrice: priceForCalc,
          stopLoss: stop_loss,
          side,
          qtyStep: symbolInfo.qtyStep,
          minQty: symbolInfo.minQty,
        });

        const orderResult = await withRetry(() => placeOrder(client, {
          symbol,
          side,
          orderType: order_type,
          quantity,
          entryPrice: entry_price,
          stopLoss: stop_loss,
          takeProfit: take_profit,
          tickSize: symbolInfo.tickSize,
        }));

        result = {
          account_id: account.id,
          account_name: account.name,
          status: 'success',
          order_id: orderResult.orderId,
          quantity: orderResult.quantity,
          balance: accountBalance,
        };
      } catch (err: unknown) {
        const errorMessage = extractErrorMessage(err);
        result = {
          account_id: account.id,
          account_name: account.name,
          status: 'failed',
          balance: accountBalance,
          error_message: errorMessage,
        };
      }

      await supabase.from('trade_executions').insert({
        trade_log_id: tradeLog.id,
        account_id: result.account_id,
        account_name: result.account_name,
        status: result.status,
        order_id: result.order_id ?? null,
        quantity: result.quantity ?? null,
        error_message: result.error_message ?? null,
      });

      results.push(result);
    }

    return NextResponse.json({ trade_id: tradeLog.id, results });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('trade_logs')
      .select('*, trade_executions(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
