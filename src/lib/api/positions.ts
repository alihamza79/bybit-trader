import type { PositionInfo } from '@/lib/bybit';

export type AccountPositions = {
  account_id: string;
  account_name: string;
  positions: ReadonlyArray<PositionInfo>;
};

export async function fetchPositions(): Promise<ReadonlyArray<AccountPositions>> {
  const res = await fetch('/api/positions');
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error ?? 'Failed to fetch positions');
  }
  return res.json();
}

export async function updatePositionTpSl(params: {
  account_id: string;
  symbol: string;
  position_idx: 0 | 1 | 2;
  stop_loss?: string;
  take_profit?: string;
}): Promise<{ success: boolean }> {
  const res = await fetch('/api/positions', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error ?? 'Failed to update TP/SL');
  }
  return res.json();
}

export async function closePosition(params: {
  account_id: string;
  symbol: string;
  side: string;
  size: string;
}): Promise<{ success: boolean; orderId: string }> {
  const res = await fetch('/api/positions', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error ?? 'Failed to close position');
  }
  return res.json();
}
