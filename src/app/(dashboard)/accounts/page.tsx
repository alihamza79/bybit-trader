'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAccounts, useAccountBalances, useUpdateAccount, useDeleteAccount } from '@/hooks/useAccounts';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Plus, Trash2, Wallet, Pencil, Check, X, RefreshCw, Globe, Shield, ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { Account, RiskType } from '@/types';
import type { AccountBalance, ProxyTestResult } from '@/lib/api/accounts';
import { testProxy } from '@/lib/api/accounts';

type EditState = {
  field: 'name' | 'risk' | 'proxy';
  accountId: string;
};

function InlineNameEditor({
  value,
  onSave,
  onCancel,
}: {
  value: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}): React.JSX.Element {
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter') onSave(text);
    if (e.key === 'Escape') onCancel();
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        className="rounded-md border border-primary bg-input-bg px-2 py-0.5 text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        style={{ width: `${Math.max(text.length * 8 + 20, 80)}px` }}
      />
      <button type="button" onClick={() => onSave(text)} className="text-success hover:text-success/80">
        <Check size={14} />
      </button>
      <button type="button" onClick={onCancel} className="text-muted hover:text-danger">
        <X size={14} />
      </button>
    </div>
  );
}

function InlineRiskEditor({
  riskType,
  riskAmount,
  riskPercent,
  onSave,
  onCancel,
}: {
  riskType: RiskType;
  riskAmount: number;
  riskPercent: number | null;
  onSave: (type: RiskType, amount: number, percent: number | null) => void;
  onCancel: () => void;
}): React.JSX.Element {
  const [type, setType] = useState<RiskType>(riskType);
  const [amount, setAmount] = useState(String(riskAmount));
  const [percent, setPercent] = useState(String(riskPercent ?? ''));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function handleSave(): void {
    if (type === 'amount') {
      const val = parseFloat(amount);
      if (isNaN(val) || val < 1) return;
      onSave(type, val, null);
    } else {
      const val = parseFloat(percent);
      if (isNaN(val) || val < 0.1 || val > 100) return;
      onSave(type, riskAmount, val);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') onCancel();
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-md border border-card-border overflow-hidden text-xs">
        <button
          type="button"
          onClick={() => setType('amount')}
          className={`px-2 py-1 transition-colors ${type === 'amount' ? 'bg-primary text-black font-medium' : 'bg-input-bg text-muted hover:text-foreground'}`}
        >
          USDT
        </button>
        <button
          type="button"
          onClick={() => setType('percent')}
          className={`px-2 py-1 transition-colors ${type === 'percent' ? 'bg-primary text-black font-medium' : 'bg-input-bg text-muted hover:text-foreground'}`}
        >
          %
        </button>
      </div>

      {type === 'amount' ? (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted">$</span>
          <input
            ref={inputRef}
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={handleKeyDown}
            min="1"
            step="1"
            className="w-24 rounded-md border border-primary bg-input-bg px-2 py-0.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            type="number"
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            onKeyDown={handleKeyDown}
            min="0.1"
            max="100"
            step="0.1"
            className="w-20 rounded-md border border-primary bg-input-bg px-2 py-0.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <span className="text-xs text-muted">%</span>
        </div>
      )}

      <button type="button" onClick={handleSave} className="text-success hover:text-success/80">
        <Check size={14} />
      </button>
      <button type="button" onClick={onCancel} className="text-muted hover:text-danger">
        <X size={14} />
      </button>
    </div>
  );
}

function InlineProxyEditor({
  value,
  onSave,
  onCancel,
}: {
  value: string;
  onSave: (v: string | null) => void;
  onCancel: () => void;
}): React.JSX.Element {
  const [text, setText] = useState(value);
  const [localTest, setLocalTest] = useState<(ProxyTestResult & { loading?: boolean }) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter') onSave(text.trim() || null);
    if (e.key === 'Escape') onCancel();
  }

  async function handleTest(): Promise<void> {
    const url = text.trim();
    if (!url) return;
    setLocalTest({ direct_ip: '', proxy_ip: null, same_ip: null, loading: true });
    try {
      const result = await testProxy(url);
      setLocalTest({ ...result, loading: false });
    } catch (err: unknown) {
      setLocalTest({
        direct_ip: '', proxy_ip: null, same_ip: null,
        error: err instanceof Error ? err.message : 'Test failed',
        loading: false,
      });
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Globe size={12} className="text-muted shrink-0" />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => { setText(e.target.value); setLocalTest(null); }}
          onKeyDown={handleKeyDown}
          placeholder="http://user:pass@ip:port or socks5://..."
          className="w-80 rounded-md border border-primary bg-input-bg px-2 py-1 text-xs text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <button type="button" onClick={() => onSave(text.trim() || null)} className="text-success hover:text-success/80">
          <Check size={14} />
        </button>
        <button type="button" onClick={onCancel} className="text-muted hover:text-danger">
          <X size={14} />
        </button>
        {text.trim() && (
          <button
            type="button"
            onClick={handleTest}
            disabled={localTest?.loading}
            className="flex items-center gap-1 text-xs text-muted hover:text-primary transition-colors disabled:opacity-50 ml-1"
          >
            {localTest?.loading ? <Loader2 size={11} className="animate-spin" /> : <Shield size={11} />}
            <span>{localTest?.loading ? 'Testing...' : 'Test'}</span>
          </button>
        )}
      </div>
      {value && (
        <button
          type="button"
          onClick={() => onSave(null)}
          className="flex items-center gap-1 text-xs text-danger hover:text-danger/80 transition-colors ml-5"
        >
          <X size={10} />
          <span>Remove proxy</span>
        </button>
      )}
      {localTest && !localTest.loading && (
        <div className={`ml-5 flex items-start gap-1.5 text-xs rounded-md border px-2 py-1.5 ${
          localTest.error ?? localTest.same_ip
            ? 'border-danger/20 bg-danger/10 text-danger'
            : 'border-success/20 bg-success/10 text-success'
        }`}>
          {localTest.error ? (
            <><ShieldAlert size={12} className="shrink-0 mt-0.5" /><span>{localTest.error}</span></>
          ) : localTest.same_ip ? (
            <><ShieldAlert size={12} className="shrink-0 mt-0.5" /><span>IPs match — proxy not working</span></>
          ) : (
            <><ShieldCheck size={12} className="shrink-0 mt-0.5" /><span>Working — Your IP: {localTest.direct_ip} → Proxy: {localTest.proxy_ip}</span></>
          )}
        </div>
      )}
    </div>
  );
}

export default function AccountsPage(): React.JSX.Element {
  const { data: accounts, isLoading, isError, error } = useAccounts();
  const [balancesEnabled, setBalancesEnabled] = useState(false);
  const { data: balancesData, isLoading: loadingBalances, isRefetching: refetchingBalances } = useAccountBalances(balancesEnabled);
  const updateMutation = useUpdateAccount();
  const deleteMutation = useDeleteAccount();
  const queryClient = useQueryClient();
  const [editState, setEditState] = useState<EditState | null>(null);
  const [proxyTestResults, setProxyTestResults] = useState<Record<string, ProxyTestResult & { loading?: boolean }>>({});

  async function handleTestProxy(accountId: string, proxyUrl: string | null): Promise<void> {
    setProxyTestResults((prev) => ({
      ...prev,
      [accountId]: { direct_ip: '', proxy_ip: null, same_ip: null, loading: true },
    }));
    try {
      const result = await testProxy(proxyUrl);
      setProxyTestResults((prev) => ({ ...prev, [accountId]: { ...result, loading: false } }));
    } catch (err: unknown) {
      setProxyTestResults((prev) => ({
        ...prev,
        [accountId]: {
          direct_ip: '',
          proxy_ip: null,
          same_ip: null,
          error: err instanceof Error ? err.message : 'Test failed',
          loading: false,
        },
      }));
    }
  }

  const balances = useMemo(() => {
    const map: Record<string, AccountBalance> = {};
    if (balancesData) {
      for (const b of balancesData) {
        map[b.account_id] = b;
      }
    }
    return map;
  }, [balancesData]);

  function handleFetchBalances(): void {
    if (balancesEnabled) {
      queryClient.invalidateQueries({ queryKey: ['account-balances'] });
    } else {
      setBalancesEnabled(true);
    }
  }

  function handleToggle(id: string, currentActive: boolean): void {
    updateMutation.mutate({ id, data: { is_active: !currentActive } });
  }

  function handleDelete(id: string): void {
    if (window.confirm('Delete this account? This cannot be undone.')) {
      deleteMutation.mutate(id);
    }
  }

  function handleSaveName(accountId: string, name: string): void {
    if (!name.trim()) return;
    updateMutation.mutate(
      { id: accountId, data: { name: name.trim() } },
      { onSuccess: () => setEditState(null) },
    );
  }

  function handleSaveRisk(accountId: string, type: RiskType, amount: number, percent: number | null): void {
    updateMutation.mutate(
      { id: accountId, data: { risk_type: type, risk_amount: amount, risk_percent: percent } },
      { onSuccess: () => setEditState(null) },
    );
  }

  function handleSaveProxy(accountId: string, proxyUrl: string | null): void {
    updateMutation.mutate(
      { id: accountId, data: { proxy_url: proxyUrl ?? '' } },
      { onSuccess: () => setEditState(null) },
    );
  }

  function formatRisk(account: Account): string {
    if (account.risk_type === 'percent') {
      return `${Number(account.risk_percent)}% of balance`;
    }
    return `$${Number(account.risk_amount).toLocaleString()} USDT`;
  }

  const isBalanceLoading = loadingBalances || refetchingBalances;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Accounts</h1>
          <p className="text-sm text-muted">Manage your Bybit sub-accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleFetchBalances}
            disabled={isBalanceLoading || !accounts?.length}
          >
            {balancesEnabled ? (
              <RefreshCw size={16} className={`mr-1.5 ${isBalanceLoading ? 'animate-spin' : ''}`} />
            ) : (
              <Wallet size={16} className="mr-1.5" />
            )}
            {isBalanceLoading ? 'Loading...' : balancesEnabled ? 'Refresh Balances' : 'Fetch Balances'}
          </Button>
          <Link href="/accounts/new">
            <Button size="sm">
              <Plus size={16} className="mr-1.5" />
              Add Account
            </Button>
          </Link>
        </div>
      </div>

      {isLoading && (
        <Card className="text-center text-sm text-muted">Loading accounts...</Card>
      )}

      {isError && (
        <Card className="text-center text-sm text-danger">
          {error instanceof Error ? error.message : 'Failed to load accounts'}
        </Card>
      )}

      {accounts && accounts.length === 0 && (
        <Card className="text-center">
          <p className="text-sm text-muted">No accounts yet. Add your first Bybit account to get started.</p>
          <Link href="/accounts/new" className="mt-3 inline-block">
            <Button size="sm">
              <Plus size={16} className="mr-1.5" />
              Add Account
            </Button>
          </Link>
        </Card>
      )}

      {accounts && accounts.length > 0 && (
        <div className="space-y-3">
          {accounts.map((account) => {
            const bal = balances[account.id];
            const isEditingName = editState?.field === 'name' && editState.accountId === account.id;
            const isEditingRisk = editState?.field === 'risk' && editState.accountId === account.id;
            const isEditingProxy = editState?.field === 'proxy' && editState.accountId === account.id;

            return (
              <Card key={account.id}>
                <div className="flex items-start justify-between">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {isEditingName ? (
                        <InlineNameEditor
                          value={account.name}
                          onSave={(v) => handleSaveName(account.id, v)}
                          onCancel={() => setEditState(null)}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditState({ field: 'name', accountId: account.id })}
                          className="group flex items-center gap-1.5 hover:text-primary transition-colors"
                        >
                          <span className="font-medium">{account.name}</span>
                          <Pencil size={12} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      )}
                      <Badge variant={account.is_active ? 'success' : 'muted'}>
                        {account.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
                      <div className="flex items-center gap-1">
                        <span>Risk:</span>
                        {isEditingRisk ? (
                          <InlineRiskEditor
                            riskType={(account.risk_type as RiskType) || 'amount'}
                            riskAmount={account.risk_amount}
                            riskPercent={account.risk_percent}
                            onSave={(type, amt, pct) => handleSaveRisk(account.id, type, amt, pct)}
                            onCancel={() => setEditState(null)}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditState({ field: 'risk', accountId: account.id })}
                            className="group flex items-center gap-1 hover:text-primary transition-colors"
                          >
                            <span className="font-medium text-foreground">{formatRisk(account)}</span>
                            <Pencil size={10} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        )}
                      </div>

                      <span>Key: {account.api_key.slice(0, 8)}...{account.api_key.slice(-4)}</span>

                      {!isEditingProxy && (
                        <button
                          type="button"
                          onClick={() => setEditState({ field: 'proxy', accountId: account.id })}
                          className={`group flex items-center gap-1 transition-colors ${account.proxy_url ? 'text-primary hover:text-primary/80' : 'text-muted hover:text-primary'}`}
                        >
                          <Globe size={11} />
                          <span>{account.proxy_url ? 'Proxy' : 'Add proxy'}</span>
                          <Pencil size={9} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      )}

                      {bal && bal.balance && (
                        <span className="font-medium text-foreground">
                          <span className="text-muted font-normal">Margin:</span>{' '}
                          <span className="text-primary">
                            ${bal.margin_balance ? parseFloat(bal.margin_balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                          </span>
                          <span className="mx-1.5 text-card-border">|</span>
                          <span className="text-muted font-normal">Available:</span>{' '}
                          <span className="text-success">
                            ${parseFloat(bal.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </span>
                      )}
                      {bal && bal.error && (
                        <span className="text-danger">{bal.error}</span>
                      )}
                    </div>

                    {isEditingProxy && (
                      <InlineProxyEditor
                        value={account.proxy_url ?? ''}
                        onSave={(v) => handleSaveProxy(account.id, v)}
                        onCancel={() => setEditState(null)}
                      />
                    )}

                    {!isEditingProxy && (
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => handleTestProxy(account.id, account.proxy_url)}
                        disabled={proxyTestResults[account.id]?.loading}
                        className="flex items-center gap-1 text-xs text-muted hover:text-primary transition-colors disabled:opacity-50"
                      >
                        {proxyTestResults[account.id]?.loading ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Shield size={11} />
                        )}
                        <span>{proxyTestResults[account.id]?.loading ? 'Testing...' : 'Test IP'}</span>
                      </button>

                      {proxyTestResults[account.id] && !proxyTestResults[account.id].loading && (() => {
                        const result = proxyTestResults[account.id];
                        if (result.error) {
                          return (
                            <span className="flex items-center gap-1 text-xs text-danger">
                              <ShieldAlert size={12} />
                              <span>{result.error}</span>
                            </span>
                          );
                        }
                        if (account.proxy_url) {
                          return (
                            <span className={`flex items-center gap-1 text-xs ${result.same_ip ? 'text-danger' : 'text-success'}`}>
                              {result.same_ip ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />}
                              <span>
                                Your IP: {result.direct_ip}
                                {' '}→{' '}Proxy IP: {result.proxy_ip ?? 'N/A'}
                                {result.same_ip === true && ' (SAME — proxy not working!)'}
                                {result.same_ip === false && ' (Different — proxy working)'}
                              </span>
                            </span>
                          );
                        }
                        return (
                          <span className="flex items-center gap-1 text-xs text-muted">
                            <Shield size={12} />
                            <span>Direct IP: {result.direct_ip}</span>
                          </span>
                        );
                      })()}
                    </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggle(account.id, account.is_active)}
                      disabled={updateMutation.isPending}
                    >
                      {account.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(account.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 size={16} className="text-danger" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
