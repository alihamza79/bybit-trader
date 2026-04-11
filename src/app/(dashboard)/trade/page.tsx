'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useExecuteTrade } from '@/hooks/useTrades';
import { useAccounts, useAccountBalances, useUpdateAccount } from '@/hooks/useAccounts';
import { tradeSchema, type TradeFormData } from '@/lib/validations/trade';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { DEFAULT_SYMBOL } from '@/config/constants';
import type { TradeResponse, Account, RiskType } from '@/types';
import type { AccountBalance } from '@/lib/api/accounts';
import { Zap, CheckCircle, XCircle, Pencil, Check, X, Wallet, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

function InlineRiskOverrideEditor({
  defaultType,
  defaultValue,
  onSave,
  onCancel,
}: {
  defaultType: RiskType;
  defaultValue: number;
  onSave: (type: RiskType, value: number) => void;
  onCancel: () => void;
}): React.JSX.Element {
  const [type, setType] = useState<RiskType>(defaultType);
  const [value, setValue] = useState(String(defaultValue));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function handleSave(): void {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return;
    if (type === 'percent' && num > 100) return;
    onSave(type, num);
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') onCancel();
  }

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.preventDefault()}>
      <div className="flex rounded border border-card-border overflow-hidden text-[10px]">
        <button
          type="button"
          onClick={() => setType('amount')}
          className={`px-1.5 py-0.5 transition-colors ${type === 'amount' ? 'bg-primary text-black font-medium' : 'bg-input-bg text-muted'}`}
        >
          $
        </button>
        <button
          type="button"
          onClick={() => setType('percent')}
          className={`px-1.5 py-0.5 transition-colors ${type === 'percent' ? 'bg-primary text-black font-medium' : 'bg-input-bg text-muted'}`}
        >
          %
        </button>
      </div>
      <input
        ref={inputRef}
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        step={type === 'percent' ? '0.1' : '1'}
        min="0"
        className="w-16 rounded border border-primary bg-input-bg px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
      />
      <button type="button" onClick={handleSave} className="text-success hover:text-success/80">
        <Check size={12} />
      </button>
      <button type="button" onClick={onCancel} className="text-muted hover:text-danger">
        <X size={12} />
      </button>
    </div>
  );
}

export default function TradePage(): React.JSX.Element {
  const [tradeResult, setTradeResult] = useState<TradeResponse | null>(null);
  const executeMutation = useExecuteTrade();
  const { data: accounts } = useAccounts();

  const activeAccounts = useMemo(
    () => accounts?.filter((a) => a.is_active) ?? [],
    [accounts],
  );

  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(null);
  const [editingRiskId, setEditingRiskId] = useState<string | null>(null);
  const updateAccountMutation = useUpdateAccount();
  const queryClient = useQueryClient();

  const [balancesEnabled, setBalancesEnabled] = useState(false);
  const { data: balancesData, isLoading: loadingBalances, isRefetching: refetchingBalances } = useAccountBalances(balancesEnabled);

  const balances = useMemo(() => {
    const map: Record<string, AccountBalance> = {};
    if (balancesData) {
      for (const b of balancesData) {
        map[b.account_id] = b;
      }
    }
    return map;
  }, [balancesData]);

  const isBalanceLoading = loadingBalances || refetchingBalances;

  function handleFetchBalances(): void {
    if (balancesEnabled) {
      queryClient.invalidateQueries({ queryKey: ['account-balances'] });
    } else {
      setBalancesEnabled(true);
    }
  }

  const effectiveSelected = useMemo(() => {
    if (selectedIds === null) {
      return new Set(activeAccounts.map((a) => a.id));
    }
    return selectedIds;
  }, [selectedIds, activeAccounts]);

  const selectedCount = effectiveSelected.size;
  const allSelected = selectedCount === activeAccounts.length && activeAccounts.length > 0;

  function toggleAccount(id: string): void {
    setSelectedIds((prev) => {
      const current = prev ?? new Set(activeAccounts.map((a) => a.id));
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll(): void {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeAccounts.map((a) => a.id)));
    }
  }

  function saveRisk(accountId: string, type: RiskType, value: number): void {
    updateAccountMutation.mutate({
      id: accountId,
      data: {
        risk_type: type,
        ...(type === 'amount' ? { risk_amount: value, risk_percent: null } : { risk_percent: value }),
      },
    });
    setEditingRiskId(null);
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    watch,
  } = useForm<TradeFormData>({
    resolver: zodResolver(tradeSchema),
    mode: 'onBlur',
    defaultValues: {
      symbol: DEFAULT_SYMBOL,
      side: 'Buy',
      order_type: 'Market',
      leverage: 10,
    },
  });

  const selectedSide = watch('side');
  const selectedOrderType = watch('order_type');

  async function onSubmit(data: TradeFormData): Promise<void> {
    if (selectedCount === 0) {
      setError('root', { message: 'Select at least one account' });
      return;
    }

    setTradeResult(null);

    try {
      const result = await executeMutation.mutateAsync({
        symbol: data.symbol,
        side: data.side,
        order_type: data.order_type,
        leverage: data.leverage,
        entry_price: data.entry_price,
        stop_loss: data.stop_loss,
        take_profit: data.take_profit,
        account_ids: Array.from(effectiveSelected),
      });
      setTradeResult(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Trade execution failed';
      setError('root', { message });
    }
  }

  function formatRisk(account: Account): string {
    if (account.risk_type === 'percent') {
      return `${Number(account.risk_percent)}%`;
    }
    return `$${Number(account.risk_amount).toLocaleString()}`;
  }

  function getAccountDefaultRiskType(account: Account): RiskType {
    return (account.risk_type as RiskType) || 'amount';
  }

  function getAccountDefaultRiskValue(account: Account): number {
    if (account.risk_type === 'percent') {
      return Number(account.risk_percent) || 1;
    }
    return account.risk_amount;
  }

  const successCount = tradeResult?.results.filter((r) => r.status === 'success').length ?? 0;
  const failedCount = tradeResult?.results.filter((r) => r.status === 'failed').length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Execute Trade</h1>
        <p className="text-sm text-muted">
          Place a trade across {selectedCount} of {activeAccounts.length} active account{activeAccounts.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Top row: Accounts + Trade form side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Account selection */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Select Accounts</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleFetchBalances}
                disabled={isBalanceLoading || !activeAccounts.length}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {balancesEnabled ? (
                  <RefreshCw size={12} className={isBalanceLoading ? 'animate-spin' : ''} />
                ) : (
                  <Wallet size={12} />
                )}
                {isBalanceLoading ? 'Loading...' : balancesEnabled ? 'Refresh' : 'Fetch Balances'}
              </button>
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs text-primary hover:text-primary-hover transition-colors"
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>

          {activeAccounts.length === 0 ? (
            <p className="text-xs text-danger">No active accounts. Add accounts first.</p>
          ) : (
            <div className="space-y-2">
              {activeAccounts.map((account) => {
                const isChecked = effectiveSelected.has(account.id);
                const isEditingThis = editingRiskId === account.id;
                const bal = balances[account.id];

                return (
                  <label
                    key={account.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                      isChecked
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-card-border hover:bg-input-bg/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleAccount(account.id)}
                      className="h-4 w-4 rounded border-input-border text-primary accent-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{account.name}</span>
                      </div>
                      {bal && bal.balance && (
                        <div className="flex items-center gap-2 text-[10px] mt-0.5">
                          <span className="text-muted">M:</span>
                          <span className="text-primary font-medium">
                            ${bal.margin_balance ? parseFloat(bal.margin_balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                          </span>
                          <span className="text-card-border">|</span>
                          <span className="text-muted">Avl:</span>
                          <span className="text-success font-medium">
                            ${parseFloat(bal.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      {bal && bal.error && (
                        <p className="text-[10px] text-danger mt-0.5">{bal.error}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.preventDefault()}>
                      {isEditingThis ? (
                        <InlineRiskOverrideEditor
                          defaultType={getAccountDefaultRiskType(account)}
                          defaultValue={getAccountDefaultRiskValue(account)}
                          onSave={(type, value) => saveRisk(account.id, type, value)}
                          onCancel={() => setEditingRiskId(null)}
                        />
                      ) : (
                        <>
                          <span className="text-xs text-muted">{formatRisk(account)}</span>
                          <button
                            type="button"
                            onClick={() => setEditingRiskId(account.id)}
                            className="text-muted hover:text-primary transition-colors"
                            title="Edit risk"
                          >
                            <Pencil size={10} />
                          </button>
                        </>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {selectedCount === 0 && activeAccounts.length > 0 && (
            <p className="mt-3 text-center text-xs text-danger">
              Select at least one account to execute the trade.
            </p>
          )}
        </Card>

        {/* Right: Trade form */}
        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {errors.root && (
              <div className="rounded-lg border border-danger/20 bg-danger/10 p-3 text-sm text-danger">
                {errors.root.message}
              </div>
            )}

            <Input
              label="Symbol"
              placeholder="BTCUSDT"
              error={errors.symbol?.message}
              {...register('symbol')}
            />

            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">Order Type</label>
              <div className="grid grid-cols-2 gap-2">
                <label
                  className={`flex cursor-pointer items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${
                    selectedOrderType === 'Market'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-input-border text-muted hover:text-foreground'
                  }`}
                >
                  <input type="radio" value="Market" className="sr-only" {...register('order_type')} />
                  Market
                </label>
                <label
                  className={`flex cursor-pointer items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${
                    selectedOrderType === 'Limit'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-input-border text-muted hover:text-foreground'
                  }`}
                >
                  <input type="radio" value="Limit" className="sr-only" {...register('order_type')} />
                  Limit
                </label>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">Side</label>
              <div className="grid grid-cols-2 gap-2">
                <label
                  className={`flex cursor-pointer items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${
                    selectedSide === 'Buy'
                      ? 'border-success bg-success/10 text-success'
                      : 'border-input-border text-muted hover:text-foreground'
                  }`}
                >
                  <input type="radio" value="Buy" className="sr-only" {...register('side')} />
                  Buy / Long
                </label>
                <label
                  className={`flex cursor-pointer items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${
                    selectedSide === 'Sell'
                      ? 'border-danger bg-danger/10 text-danger'
                      : 'border-input-border text-muted hover:text-foreground'
                  }`}
                >
                  <input type="radio" value="Sell" className="sr-only" {...register('side')} />
                  Sell / Short
                </label>
              </div>
              {errors.side && <p className="text-xs text-danger">{errors.side.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Leverage"
                type="number"
                min={1}
                max={100}
                placeholder="10"
                error={errors.leverage?.message}
                {...register('leverage', { valueAsNumber: true })}
              />

              {selectedOrderType === 'Limit' ? (
                <div>
                  <Input
                    label="Entry Price"
                    type="number"
                    step="0.01"
                    placeholder="Limit price"
                    error={errors.entry_price?.message}
                    {...register('entry_price', {
                      setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
                    })}
                  />
                </div>
              ) : (
                <div />
              )}
            </div>

            {selectedOrderType === 'Limit' && (
              <p className="text-xs text-muted -mt-2">
                {selectedSide === 'Buy'
                  ? 'Set below market price to place a pending order'
                  : 'Set above market price to place a pending order'}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Stop Loss"
                type="number"
                step="0.01"
                placeholder="Optional"
                error={errors.stop_loss?.message}
                {...register('stop_loss', {
                  setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
                })}
              />

              <Input
                label="Take Profit"
                type="number"
                step="0.01"
                placeholder="Optional"
                error={errors.take_profit?.message}
                {...register('take_profit', {
                  setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
                })}
              />
            </div>

            <Button
              type="submit"
              loading={executeMutation.isPending}
              disabled={selectedCount === 0}
              className="w-full"
              size="lg"
            >
              <Zap size={18} className="mr-2" />
              {executeMutation.isPending
                ? 'Executing...'
                : `Execute ${selectedOrderType} Order (${selectedCount} account${selectedCount !== 1 ? 's' : ''})`}
            </Button>
          </form>
        </Card>
      </div>

      {/* Bottom: Results spanning full width */}
      {(tradeResult || executeMutation.isPending) && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Execution Results</h2>

          {executeMutation.isPending && (
            <Card className="text-center">
              <div className="flex flex-col items-center gap-3">
                <svg className="h-8 w-8 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <p className="text-sm text-muted">Executing trades across accounts...</p>
              </div>
            </Card>
          )}

          {tradeResult && (
            <>
              <div className="mb-3 flex items-center gap-3 text-sm">
                <span className="text-success font-medium">{successCount} succeeded</span>
                <span className="text-card-border">|</span>
                <span className="text-danger font-medium">{failedCount} failed</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tradeResult.results.map((result) => (
                  <Card
                    key={result.account_id}
                    className={`border-l-4 ${
                      result.status === 'success' ? 'border-l-success' : 'border-l-danger'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {result.status === 'success' ? (
                        <CheckCircle size={16} className="text-success shrink-0" />
                      ) : (
                        <XCircle size={16} className="text-danger shrink-0" />
                      )}
                      <span className="font-medium truncate">{result.account_name}</span>
                      <Badge variant={result.status === 'success' ? 'success' : 'danger'}>
                        {result.status}
                      </Badge>
                    </div>

                    {result.balance && (
                      <p className="text-xs text-muted mb-1">Balance: ${result.balance}</p>
                    )}

                    {result.status === 'success' && (
                      <div className="space-y-0.5 text-xs text-muted">
                        <p>Order: <span className="font-mono">{result.order_id}</span></p>
                        <p>Qty: {result.quantity}</p>
                      </div>
                    )}

                    {result.status === 'failed' && result.error_message && (
                      <p className="text-xs text-danger">{result.error_message}</p>
                    )}
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
