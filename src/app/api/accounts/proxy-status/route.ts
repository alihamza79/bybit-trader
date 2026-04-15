import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { verifyAccountProxies } from '@/lib/utils/proxy-check';

export type ProxyStatusResult = {
  account_id: string;
  account_name: string;
  proxy_url: string;
  status: 'ok' | 'failed';
  error?: string;
};

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: accounts, error } = await supabase
      .from('bybit_accounts')
      .select('id, name, proxy_url')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const proxiedAccounts = (accounts ?? []).filter(
      (a): a is typeof a & { proxy_url: string } => !!a.proxy_url,
    );

    if (proxiedAccounts.length === 0) {
      return NextResponse.json([]);
    }

    const failures = await verifyAccountProxies(proxiedAccounts);

    const results: ProxyStatusResult[] = proxiedAccounts.map((a) => {
      const err = failures.get(a.id);
      return {
        account_id: a.id,
        account_name: a.name,
        proxy_url: a.proxy_url,
        status: err ? 'failed' : 'ok',
        error: err,
      };
    });

    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
