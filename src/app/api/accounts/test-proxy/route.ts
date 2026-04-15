import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { fetchDirectIp, fetchIpViaProxy } from '@/lib/utils/proxy-check';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as { proxy_url?: string };
    const proxyUrl = body.proxy_url?.trim();

    const directIp = await fetchDirectIp();

    if (!proxyUrl) {
      return NextResponse.json({
        direct_ip: directIp,
        proxy_ip: null,
        same_ip: true,
        message: 'No proxy configured — using direct connection',
      });
    }

    try {
      const proxyIp = await fetchIpViaProxy(proxyUrl);
      const sameIp = proxyIp === directIp;

      return NextResponse.json({
        direct_ip: directIp,
        proxy_ip: proxyIp,
        same_ip: sameIp,
        message: sameIp
          ? 'WARNING: Proxy IP matches your direct IP — proxy may not be working'
          : `Proxy working — traffic will appear from ${proxyIp}`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({
        direct_ip: directIp,
        proxy_ip: null,
        same_ip: null,
        error: `Proxy connection failed: ${msg}`,
      });
    }
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
