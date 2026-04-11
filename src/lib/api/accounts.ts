import type { Account, AccountInsert } from '@/types';

export type AccountBalance = {
  account_id: string;
  balance: string | null;
  margin_balance: string | null;
  error?: string;
};

export async function fetchAccounts(): Promise<ReadonlyArray<Account>> {
  const res = await fetch('/api/accounts');
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error ?? 'Failed to fetch accounts');
  }
  return res.json();
}

export async function fetchAccountBalances(): Promise<ReadonlyArray<AccountBalance>> {
  const res = await fetch('/api/accounts/balances');
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error ?? 'Failed to fetch balances');
  }
  return res.json();
}

export async function createAccount(data: AccountInsert): Promise<Account> {
  const res = await fetch('/api/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error ?? 'Failed to create account');
  }
  return res.json();
}

export async function updateAccount(
  id: string,
  data: Partial<AccountInsert & { is_active: boolean }>,
): Promise<Account> {
  const res = await fetch(`/api/accounts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error ?? 'Failed to update account');
  }
  return res.json();
}

export async function deleteAccount(id: string): Promise<void> {
  const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error ?? 'Failed to delete account');
  }
}
