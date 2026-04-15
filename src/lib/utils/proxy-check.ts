import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import https from 'node:https';
import http from 'node:http';

const IP_CHECK_URL = 'https://api.ipify.org?format=json';
const PROXY_TIMEOUT_MS = 10_000;

let cachedDirectIp: string | null = null;
let cachedDirectIpTimestamp = 0;
const DIRECT_IP_CACHE_TTL_MS = 60_000;

export type ProxyVerification = {
  ok: boolean;
  directIp: string;
  proxyIp: string | null;
  error?: string;
};

export async function fetchDirectIp(): Promise<string> {
  const now = Date.now();
  if (cachedDirectIp && now - cachedDirectIpTimestamp < DIRECT_IP_CACHE_TTL_MS) {
    return cachedDirectIp;
  }

  const res = await fetch(IP_CHECK_URL);
  if (!res.ok) throw new Error(`IP check failed: ${res.status}`);
  const data = (await res.json()) as { ip: string };
  cachedDirectIp = data.ip;
  cachedDirectIpTimestamp = now;
  return data.ip;
}

export function fetchIpViaProxy(proxyUrl: string): Promise<string> {
  const agent = proxyUrl.startsWith('socks')
    ? new SocksProxyAgent(proxyUrl)
    : new HttpsProxyAgent(proxyUrl);

  return new Promise((resolve, reject) => {
    const url = new URL(IP_CHECK_URL);
    const options: https.RequestOptions = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      agent: agent as unknown as http.Agent,
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body) as { ip: string };
          resolve(parsed.ip);
        } catch {
          reject(new Error(`Failed to parse IP response: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(PROXY_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('Proxy connection timed out'));
    });
    req.end();
  });
}

/**
 * Verifies a proxy is working and returns a different IP than our direct connection.
 * Returns { ok: true } if the proxy is safe to use, { ok: false, error } if not.
 */
export async function verifyProxy(proxyUrl: string): Promise<ProxyVerification> {
  try {
    const [directIp, proxyIp] = await Promise.all([
      fetchDirectIp(),
      fetchIpViaProxy(proxyUrl),
    ]);

    if (proxyIp === directIp) {
      return {
        ok: false,
        directIp,
        proxyIp,
        error: `BLOCKED: Proxy IP (${proxyIp}) matches your direct IP — proxy is not masking your connection`,
      };
    }

    return { ok: true, directIp, proxyIp };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      directIp: cachedDirectIp ?? 'unknown',
      proxyIp: null,
      error: `BLOCKED: Proxy unreachable — ${msg}`,
    };
  }
}

/**
 * Batch-verifies proxies for multiple accounts. Returns a map of account_id -> error message.
 * Only accounts with a proxy_url are checked. Accounts without a proxy pass automatically.
 * All proxy checks run in parallel for speed.
 */
export async function verifyAccountProxies(
  accounts: ReadonlyArray<{ id: string; name: string; proxy_url: string | null }>,
): Promise<Map<string, string>> {
  const failures = new Map<string, string>();

  const accountsWithProxy = accounts.filter(
    (a): a is typeof a & { proxy_url: string } => !!a.proxy_url,
  );

  if (accountsWithProxy.length === 0) return failures;

  const uniqueProxies = [...new Set(accountsWithProxy.map((a) => a.proxy_url))];

  const proxyResults = new Map<string, ProxyVerification>();
  const verifications = await Promise.all(
    uniqueProxies.map(async (url) => {
      const result = await verifyProxy(url);
      return { url, result };
    }),
  );

  for (const { url, result } of verifications) {
    proxyResults.set(url, result);
  }

  for (const account of accountsWithProxy) {
    const result = proxyResults.get(account.proxy_url);
    if (result && !result.ok) {
      failures.set(account.id, result.error ?? 'Proxy verification failed');
    }
  }

  return failures;
}
