'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAccounts, useAccountBalances, useUpdateAccount, useDeleteAccount } from '@/hooks/useAccounts';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Plus, Trash2, Wallet, Pencil, Check, X, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { Account, RiskType } from '@/types';
import type { AccountBalance } from '@/lib/api/accounts';

type EditState = {
  field: 'name' | 'risk';
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

export default function AccountsPage(): React.JSX.Element {
  const { data: accounts, isLoading, isError, error } = useAccounts();
  const [balancesEnabled, setBalancesEnabled] = useState(false);
  const { data: balancesData, isLoading: loadingBalances, isRefetching: refetchingBalances } = useAccountBalances(balancesEnabled);
  const updateMutation = useUpdateAccount();
  const deleteMutation = useDeleteAccount();
  const queryClient = useQueryClient();
  const [editState, setEditState] = useState<EditState | null>(null);

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

                      {bal && bal.balance && (
                        <span className="font-medium text-success">
                          Balance: ${parseFloat(bal.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                      {bal && bal.error && (
                        <span className="text-danger">{bal.error}</span>
                      )}
                    </div>
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
