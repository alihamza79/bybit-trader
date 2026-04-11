'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchAccounts,
  fetchAccountBalances,
  createAccount,
  updateAccount,
  deleteAccount,
} from '@/lib/api/accounts';
import type { AccountInsert } from '@/types';

const ACCOUNTS_KEY = ['accounts'] as const;
const BALANCES_KEY = ['account-balances'] as const;

export function useAccounts() {
  return useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: fetchAccounts,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAccountBalances(enabled: boolean) {
  return useQuery({
    queryKey: BALANCES_KEY,
    queryFn: fetchAccountBalances,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AccountInsert) => createAccount(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY });
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AccountInsert & { is_active: boolean }> }) =>
      updateAccount(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY });
    },
  });
}
