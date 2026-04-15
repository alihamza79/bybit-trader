import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createBybitClient, getWalletBalance } from '@/lib/bybit';
import { withRetry, extractErrorMessage } from '@/lib/utils/retry';
import { verifyProxy } from '@/lib/utils/proxy-check';

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: accounts, error } = await supabase
      .from('bybit_accounts')
      .select('id, api_key, api_secret, proxy_url')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results = [];

    for (const account of accounts ?? []) {
      if (account.proxy_url) {
        const proxyCheck = await verifyProxy(account.proxy_url);
        if (!proxyCheck.ok) {
          results.push({
            account_id: account.id,
            balance: null,
            margin_balance: null,
            error: proxyCheck.error ?? 'Proxy verification failed',
          });
          continue;
        }
      }

      try {
        const client = createBybitClient({ apiKey: account.api_key, apiSecret: account.api_secret, proxyUrl: account.proxy_url });
        const walletInfo = await withRetry(() => getWalletBalance(client));
        results.push({
          account_id: account.id,
          balance: walletInfo.availableBalance.toFixed(2),
          margin_balance: walletInfo.marginBalance.toFixed(2),
        });
      } catch (err: unknown) {
        results.push({
          account_id: account.id,
          balance: null,
          error: extractErrorMessage(err),
        });
      }
    }

    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
