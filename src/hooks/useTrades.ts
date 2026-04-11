'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { executeTrade, fetchTradeLogs } from '@/lib/api/trades';
import type { TradeRequest } from '@/types';

const TRADE_LOGS_KEY = ['trade-logs'] as const;

export function useTradeLogs() {
  return useQuery({
    queryKey: TRADE_LOGS_KEY,
    queryFn: fetchTradeLogs,
    staleTime: 5 * 60 * 1000,
  });
}

export function useExecuteTrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TradeRequest) => executeTrade(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRADE_LOGS_KEY });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['open-orders'] });
    },
  });
}
