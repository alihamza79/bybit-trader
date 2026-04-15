'use client';

import { ProxyStatusContext, useProxyStatusQuery } from '@/hooks/useProxyStatus';
import { ProxyWarningBanner } from '@/components/ProxyWarningBanner';

export function ProxyStatusProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  const value = useProxyStatusQuery();

  return (
    <ProxyStatusContext.Provider value={value}>
      <ProxyWarningBanner />
      {children}
    </ProxyStatusContext.Provider>
  );
}
