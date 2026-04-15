'use client';

import { useProxyStatus } from '@/hooks/useProxyStatus';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export function ProxyWarningBanner(): React.JSX.Element | null {
  const { blockedAccounts, isLoading, refetch } = useProxyStatus();

  if (isLoading || blockedAccounts.length === 0) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 mb-4">
      <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3">
        <div className="flex items-start gap-3">
          <ShieldAlert size={20} className="text-danger shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-danger">
              Proxy Failed — Account{blockedAccounts.length > 1 ? 's' : ''} Blocked
            </p>
            <p className="text-xs text-danger/80 mt-0.5">
              All operations (trading, orders, positions) are blocked for the following account{blockedAccounts.length > 1 ? 's' : ''} to protect them.
              Update the proxy on the{' '}
              <Link href="/accounts" className="underline font-medium hover:text-danger">
                Accounts page
              </Link>.
            </p>
            <ul className="mt-2 space-y-1">
              {blockedAccounts.map((item) => (
                <li key={item.account_id} className="text-xs text-danger/90 flex items-start gap-1.5">
                  <span className="shrink-0 mt-0.5">•</span>
                  <span>
                    <span className="font-medium">{item.account_name}</span>
                    {item.error && (
                      <span className="text-danger/70"> — {item.error}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="shrink-0 text-danger/70 hover:text-danger transition-colors"
            title="Re-check proxies"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
