'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateAccount } from '@/hooks/useAccounts';
import { accountSchema, type AccountFormData } from '@/lib/validations/account';
import { testProxy, type ProxyTestResult } from '@/lib/api/accounts';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Shield, ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';

export default function NewAccountPage(): React.JSX.Element {
  const router = useRouter();
  const createMutation = useCreateAccount();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    mode: 'onBlur',
    defaultValues: {
      risk_type: 'amount',
      risk_amount: 100,
      risk_percent: undefined,
    },
  });

  const riskType = useWatch({ control, name: 'risk_type' });
  const proxyUrlValue = useWatch({ control, name: 'proxy_url' });
  const [proxyTest, setProxyTest] = useState<(ProxyTestResult & { loading?: boolean }) | null>(null);

  async function handleTestProxy(): Promise<void> {
    setProxyTest({ direct_ip: '', proxy_ip: null, same_ip: null, loading: true });
    try {
      const result = await testProxy(proxyUrlValue ?? null);
      setProxyTest({ ...result, loading: false });
    } catch (err: unknown) {
      setProxyTest({
        direct_ip: '',
        proxy_ip: null,
        same_ip: null,
        error: err instanceof Error ? err.message : 'Test failed',
        loading: false,
      });
    }
  }

  async function onSubmit(data: AccountFormData): Promise<void> {
    try {
      await createMutation.mutateAsync({
        name: data.name,
        api_key: data.api_key,
        api_secret: data.api_secret,
        risk_type: data.risk_type,
        risk_amount: data.risk_amount ?? 100,
        risk_percent: data.risk_percent ?? null,
        proxy_url: data.proxy_url || null,
      });
      router.push('/accounts');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create account';
      setError('root', { message });
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Add Account</h1>
        <p className="text-sm text-muted">Connect a Bybit sub-account</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {errors.root && (
            <div className="rounded-lg border border-danger/20 bg-danger/10 p-3 text-sm text-danger">
              {errors.root.message}
            </div>
          )}

          <Input
            label="Account Name"
            placeholder="e.g. Main Account, Sub-Account 1"
            error={errors.name?.message}
            {...register('name')}
          />

          <Input
            label="API Key"
            placeholder="Your Bybit API key"
            error={errors.api_key?.message}
            {...register('api_key')}
          />

          <Input
            label="API Secret"
            type="password"
            placeholder="Your Bybit API secret"
            error={errors.api_secret?.message}
            {...register('api_secret')}
          />

          <div>
            <Input
              label="Proxy URL (optional)"
              placeholder="socks5://127.0.0.1:1080 or http://user:pass@ip:port"
              error={errors.proxy_url?.message}
              {...register('proxy_url')}
            />
            {proxyUrlValue && (
              <div className="mt-2 space-y-1.5">
                <button
                  type="button"
                  onClick={handleTestProxy}
                  disabled={proxyTest?.loading}
                  className="flex items-center gap-1.5 text-xs text-muted hover:text-primary transition-colors disabled:opacity-50"
                >
                  {proxyTest?.loading ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Shield size={12} />
                  )}
                  <span>{proxyTest?.loading ? 'Testing proxy...' : 'Test proxy connection'}</span>
                </button>
                {proxyTest && !proxyTest.loading && (
                  <div className={`flex items-start gap-1.5 text-xs rounded-lg border px-3 py-2 ${
                    proxyTest.error
                      ? 'border-danger/20 bg-danger/10 text-danger'
                      : proxyTest.same_ip
                        ? 'border-danger/20 bg-danger/10 text-danger'
                        : 'border-success/20 bg-success/10 text-success'
                  }`}>
                    {proxyTest.error ? (
                      <><ShieldAlert size={14} className="shrink-0 mt-0.5" /><span>{proxyTest.error}</span></>
                    ) : proxyTest.same_ip ? (
                      <><ShieldAlert size={14} className="shrink-0 mt-0.5" /><span>Proxy NOT working — Your IP ({proxyTest.direct_ip}) matches proxy IP ({proxyTest.proxy_ip})</span></>
                    ) : (
                      <><ShieldCheck size={14} className="shrink-0 mt-0.5" /><span>Proxy working — Your IP: {proxyTest.direct_ip} → Proxy IP: {proxyTest.proxy_ip}</span></>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Risk Mode</label>
            <div className="flex gap-2">
              <label
                className={`flex-1 cursor-pointer rounded-lg border p-3 text-center text-sm transition-colors ${
                  riskType === 'amount'
                    ? 'border-primary bg-primary/10 font-medium text-primary'
                    : 'border-border hover:bg-muted/5'
                }`}
              >
                <input
                  type="radio"
                  value="amount"
                  className="sr-only"
                  {...register('risk_type')}
                />
                Fixed USDT
              </label>
              <label
                className={`flex-1 cursor-pointer rounded-lg border p-3 text-center text-sm transition-colors ${
                  riskType === 'percent'
                    ? 'border-primary bg-primary/10 font-medium text-primary'
                    : 'border-border hover:bg-muted/5'
                }`}
              >
                <input
                  type="radio"
                  value="percent"
                  className="sr-only"
                  {...register('risk_type')}
                />
                % of Balance
              </label>
            </div>
          </div>

          {riskType === 'amount' && (
            <Input
              label="Risk Amount (USDT)"
              type="number"
              step="1"
              min="1"
              max="1000000"
              placeholder="100"
              error={errors.risk_amount?.message}
              {...register('risk_amount', { valueAsNumber: true })}
            />
          )}

          {riskType === 'percent' && (
            <Input
              label="Risk Percentage (%)"
              type="number"
              step="0.1"
              min="0.1"
              max="100"
              placeholder="1.0"
              error={errors.risk_percent?.message}
              {...register('risk_percent', { valueAsNumber: true })}
            />
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={isSubmitting} className="flex-1">
              Add Account
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
