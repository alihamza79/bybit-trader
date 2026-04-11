'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchOpenOrders,
  amendOrderApi,
  cancelOrderApi,
  cancelAllOrdersApi,
  syncCancelApi,
  syncAmendApi,
} from '@/lib/api/orders';
import type { SyncResponse, OrderFingerprint } from '@/lib/api/orders';

const ORDERS_KEY = ['open-orders'] as const;

export function useOpenOrders() {
  return useQuery({
    queryKey: ORDERS_KEY,
    queryFn: fetchOpenOrders,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useAmendOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      account_id: string;
      symbol: string;
      order_id: string;
      qty?: string;
      price?: string;
      stop_loss?: string;
      take_profit?: string;
      sync_risk?: boolean;
      order_price?: string;
      order_side?: string;
      order_sl?: string;
    }) => amendOrderApi(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { account_id: string; symbol: string; order_id: string }) =>
      cancelOrderApi(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    },
  });
}

export function useCancelAllOrders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { account_id: string; symbol: string }) =>
      cancelAllOrdersApi(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    },
  });
}

export function useSyncCancel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      source_account_id: string;
      source_order_id: string;
      match: OrderFingerprint;
    }) => syncCancelApi(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    },
  });
}

export function useSyncAmend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      source_account_id: string;
      source_order_id: string;
      match: OrderFingerprint;
      price?: string;
      stop_loss?: string;
      take_profit?: string;
      sync_qty_to_risk: boolean;
    }) => syncAmendApi(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    },
  });
}

export type { SyncResponse };
