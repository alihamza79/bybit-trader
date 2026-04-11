'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPositions, closePosition, updatePositionTpSl } from '@/lib/api/positions';

const POSITIONS_KEY = ['positions'] as const;

export function usePositions() {
  return useQuery({
    queryKey: POSITIONS_KEY,
    queryFn: fetchPositions,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useClosePosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { account_id: string; symbol: string; side: string; size: string }) =>
      closePosition(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POSITIONS_KEY });
    },
  });
}

export function useUpdatePositionTpSl() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      account_id: string;
      symbol: string;
      position_idx: 0 | 1 | 2;
      stop_loss?: string;
      take_profit?: string;
    }) => updatePositionTpSl(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POSITIONS_KEY });
    },
  });
}
