import type { OpenOrderInfo } from '@/lib/bybit';

export type AccountOrders = {
  account_id: string;
  account_name: string;
  orders: ReadonlyArray<OpenOrderInfo>;
};

export async function fetchOpenOrders(): Promise<ReadonlyArray<AccountOrders>> {
  const res = await fetch('/api/orders');
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error ?? 'Failed to fetch orders');
  }
  return res.json();
}

export async function amendOrderApi(params: {
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
}): Promise<{ success: boolean; synced_qty?: string }> {
  const res = await fetch('/api/orders', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error ?? 'Failed to amend order');
  }
  return res.json();
}

export async function cancelOrderApi(params: {
  account_id: string;
  symbol: string;
  order_id: string;
}): Promise<{ success: boolean }> {
  const res = await fetch('/api/orders', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error ?? 'Failed to cancel order');
  }
  return res.json();
}

export async function cancelAllOrdersApi(params: {
  account_id: string;
  symbol: string;
}): Promise<{ success: boolean }> {
  const res = await fetch('/api/orders', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, cancel_all: true }),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error ?? 'Failed to cancel orders');
  }
  return res.json();
}
