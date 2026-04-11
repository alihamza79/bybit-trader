'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useExecuteTrade } from '@/hooks/useTrades';
import { useAccounts } from '@/hooks/useAccounts';
import { tradeSchema, type TradeFormData } from '@/lib/validations/trade';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { DEFAULT_SYMBOL } from '@/config/constants';
import type { TradeResponse, Account, RiskType, RiskOverride } from '@/types';
import { Zap, CheckCircle, XCircle, Pencil, Check, X, RotateCcw } from 'lucide-react';

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
  const [riskOverrides, setRiskOverrides] = useState<Record<string, RiskOverride>>({});
  const [editingRiskId, setEditingRiskId] = useState<string | null>(null);

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

  function setRiskOverride(accountId: string, type: RiskType, value: number): void {
    setRiskOverrides((prev) => ({
      ...prev,
      [accountId]: { risk_type: type, risk_value: value },
    }));
    setEditingRiskId(null);
  }

  function clearRiskOverride(accountId: string): void {
    setRiskOverrides((prev) => {
      const next = { ...prev };
      delete next[accountId];
      return next;
    });
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

    const overridesForSelected: Record<string, RiskOverride> = {};
    for (const id of effectiveSelected) {
      if (riskOverrides[id]) {
        overridesForSelected[id] = riskOverrides[id];
      }
    }

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
        risk_overrides: Object.keys(overridesForSelected).length > 0
          ? overridesForSelected
          : undefined,
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

  function formatOverride(override: RiskOverride): string {
    if (override.risk_type === 'percent') {
      return `${override.risk_value}%`;
    }
    return `$${override.risk_value.toLocaleString()}`;
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

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-bold">Execute Trade</h1>
          <p className="text-sm text-muted">
            Place a trade across {selectedCount} of {activeAccounts.length} active account{activeAccounts.length !== 1 ? 's' : ''}
          </p>
        </div>

        <Card className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Select Accounts</span>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs text-primary hover:text-primary-hover transition-colors"
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {activeAccounts.length === 0 ? (
            <p className="text-xs text-danger">No active accounts. Add accounts first.</p>
          ) : (
            <div className="space-y-2">
              {activeAccounts.map((account) => {
                const isChecked = effectiveSelected.has(account.id);
                const override = riskOverrides[account.id];
                const isEditingThis = editingRiskId === account.id;

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
                      <span className="text-sm font-medium">{account.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.preventDefault()}>
                      {isEditingThis ? (
                        <InlineRiskOverrideEditor
                          defaultType={override?.risk_type ?? getAccountDefaultRiskType(account)}
                          defaultValue={override?.risk_value ?? getAccountDefaultRiskValue(account)}
                          onSave={(type, value) => setRiskOverride(account.id, type, value)}
                          onCancel={() => setEditingRiskId(null)}
                        />
                      ) : (
                        <>
                          {override ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted line-through">{formatRisk(account)}</span>
                              <span className="text-xs font-medium text-primary">{formatOverride(override)}</span>
                              <button
                                type="button"
                                onClick={() => clearRiskOverride(account.id)}
                                className="text-muted hover:text-danger transition-colors"
                                title="Reset to default"
                              >
                                <RotateCcw size={10} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted">{formatRisk(account)}</span>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditingRiskId(account.id)}
                            className="text-muted hover:text-primary transition-colors"
                            title="Override risk for this trade"
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
        </Card>

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
                  <input
                    type="radio"
                    value="Market"
                    className="sr-only"
                    {...register('order_type')}
                  />
                  Market
                </label>
                <label
                  className={`flex cursor-pointer items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${
                    selectedOrderType === 'Limit'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-input-border text-muted hover:text-foreground'
                  }`}
                >
                  <input
                    type="radio"
                    value="Limit"
                    className="sr-only"
                    {...register('order_type')}
                  />
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
                  <input
                    type="radio"
                    value="Buy"
                    className="sr-only"
                    {...register('side')}
                  />
                  Buy / Long
                </label>
                <label
                  className={`flex cursor-pointer items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${
                    selectedSide === 'Sell'
                      ? 'border-danger bg-danger/10 text-danger'
                      : 'border-input-border text-muted hover:text-foreground'
                  }`}
                >
                  <input
                    type="radio"
                    value="Sell"
                    className="sr-only"
                    {...register('side')}
                  />
                  Sell / Short
                </label>
              </div>
              {errors.side && <p className="text-xs text-danger">{errors.side.message}</p>}
            </div>

            <Input
              label="Leverage"
              type="number"
              min={1}
              max={100}
              placeholder="10"
              error={errors.leverage?.message}
              {...register('leverage', { valueAsNumber: true })}
            />

            {selectedOrderType === 'Limit' && (
              <div>
                <Input
                  label="Entry Price"
                  type="number"
                  step="0.01"
                  placeholder="Entry price for limit order"
                  error={errors.entry_price?.message}
                  {...register('entry_price', {
                    setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
                  })}
                />
                <p className="mt-1 text-xs text-muted">
                  {selectedSide === 'Buy'
                    ? 'Set below market price to place a pending order'
                    : 'Set above market price to place a pending order'}
                </p>
              </div>
            )}

            <Input
              label="Stop Loss (optional)"
              type="number"
              step="0.01"
              placeholder="Price"
              error={errors.stop_loss?.message}
              {...register('stop_loss', {
                setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
              })}
            />

            <Input
              label="Take Profit (optional)"
              type="number"
              step="0.01"
              placeholder="Price"
              error={errors.take_profit?.message}
              {...register('take_profit', {
                setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
              })}
            />

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

            {selectedCount === 0 && activeAccounts.length > 0 && (
              <p className="text-center text-xs text-danger">
                Select at least one account to execute the trade.
              </p>
            )}
          </form>
        </Card>
      </div>

      <div>
        <div className="mb-6">
          <h1 className="text-xl font-bold">Results</h1>
          <p className="text-sm text-muted">Execution results per account</p>
        </div>

        {!tradeResult && !executeMutation.isPending && (
          <Card className="text-center text-sm text-muted">
            Submit a trade to see results here.
          </Card>
        )}

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
          <div className="space-y-3">
            {tradeResult.results.map((result) => (
              <Card
                key={result.account_id}
                className={`border-l-4 ${
                  result.status === 'success' ? 'border-l-success' : 'border-l-danger'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      {result.status === 'success' ? (
                        <CheckCircle size={16} className="text-success" />
                      ) : (
                        <XCircle size={16} className="text-danger" />
                      )}
                      <span className="font-medium">{result.account_name}</span>
                      <Badge variant={result.status === 'success' ? 'success' : 'danger'}>
                        {result.status}
                      </Badge>
                      {result.balance && (
                        <span className="text-xs text-muted">
                          Balance: ${result.balance}
                        </span>
                      )}
                    </div>

                    {result.status === 'success' && (
                      <div className="mt-2 space-y-0.5 text-xs text-muted">
                        <p>Order ID: {result.order_id}</p>
                        <p>Quantity: {result.quantity}</p>
                      </div>
                    )}

                    {result.status === 'failed' && result.error_message && (
                      <p className="mt-2 text-xs text-danger">{result.error_message}</p>
                    )}
                  </div>
                </div>
              </Card>
            ))}

            <div className="rounded-lg bg-card-border/30 px-4 py-3 text-center text-xs text-muted">
              {tradeResult.results.filter((r) => r.status === 'success').length} succeeded,{' '}
              {tradeResult.results.filter((r) => r.status === 'failed').length} failed
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
