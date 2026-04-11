'use client';

import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateAccount } from '@/hooks/useAccounts';
import { accountSchema, type AccountFormData } from '@/lib/validations/account';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

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

  async function onSubmit(data: AccountFormData): Promise<void> {
    try {
      await createMutation.mutateAsync({
        name: data.name,
        api_key: data.api_key,
        api_secret: data.api_secret,
        risk_type: data.risk_type,
        risk_amount: data.risk_amount ?? 100,
        risk_percent: data.risk_percent ?? null,
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
