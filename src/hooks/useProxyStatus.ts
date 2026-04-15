'use client';

import { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchProxyStatus, type ProxyStatusItem } from '@/lib/api/accounts';

const PROXY_STATUS_KEY = ['proxy-status'] as const;
const POLL_INTERVAL_MS = 60_000;

export type ProxyStatusContextValue = {
  blockedAccounts: ReadonlyArray<ProxyStatusItem>;
  isLoading: boolean;
  isAccountBlocked: (accountId: string) => boolean;
  getBlockReason: (accountId: string) => string | undefined;
  refetch: () => void;
};

export const ProxyStatusContext = createContext<ProxyStatusContextValue>({
  blockedAccounts: [],
  isLoading: true,
  isAccountBlocked: () => false,
  getBlockReason: () => undefined,
  refetch: () => {},
});

export function useProxyStatusQuery(): ProxyStatusContextValue {
  const { data, isLoading, refetch } = useQuery({
    queryKey: PROXY_STATUS_KEY,
    queryFn: fetchProxyStatus,
    staleTime: 30_000,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });

  const blockedAccounts = (data ?? []).filter((item) => item.status === 'failed');

  const blockedMap = new Map(
    blockedAccounts.map((item) => [item.account_id, item.error ?? 'Proxy verification failed']),
  );

  return {
    blockedAccounts,
    isLoading,
    isAccountBlocked: (id: string) => blockedMap.has(id),
    getBlockReason: (id: string) => blockedMap.get(id),
    refetch: () => { refetch(); },
  };
}

export function useProxyStatus(): ProxyStatusContextValue {
  return useContext(ProxyStatusContext);
}
