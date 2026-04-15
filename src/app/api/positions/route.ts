import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createBybitClient, getPositions, closePosition, setPositionTpSl } from '@/lib/bybit';
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

    const allPositions: Array<{
      account_id: string;
      account_name: string;
      positions: Awaited<ReturnType<typeof getPositions>>;
      error?: string;
    }> = [];

    for (let i = 0; i < (accounts?.length ?? 0); i++) {
      const account = accounts![i];
      if (i > 0) await delay(TRADE_DELAY_MS);

      const proxyError = proxyFailures.get(account.id);
      if (proxyError) {
        allPositions.push({
          account_id: account.id,
          account_name: account.name,
          positions: [],
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

        const positions = await withRetry(() => getPositions(client), 2, 500);
        allPositions.push({
          account_id: account.id,
          account_name: account.name,
          positions,
        });
      } catch (err: unknown) {
        const errorMsg = extractErrorMessage(err);
        console.error(`[positions] Failed for ${account.name}:`, errorMsg);
        allPositions.push({
          account_id: account.id,
          account_name: account.name,
          positions: [],
          error: errorMsg,
        });
      }
    }

    return NextResponse.json(allPositions);
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
      position_idx: 0 | 1 | 2;
      stop_loss?: string;
      take_profit?: string;
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

    await withRetry(() => setPositionTpSl(client, {
      symbol: body.symbol,
      positionIdx: body.position_idx,
      stopLoss: body.stop_loss,
      takeProfit: body.take_profit,
    }));

    return NextResponse.json({ success: true });
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
      side: string;
      size: string;
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

    const orderId = await withRetry(() => closePosition(client, {
      symbol: body.symbol,
      side: body.side,
      size: body.size,
    }));

    return NextResponse.json({ success: true, orderId });
  } catch (err: unknown) {
    return NextResponse.json({ error: extractErrorMessage(err) }, { status: 500 });
  }
}
