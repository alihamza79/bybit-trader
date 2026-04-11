import type { OpenOrderInfo } from '@/lib/bybit';

export type AccountOrders = {
  account_id: string;
  account_name: string;
  orders: ReadonlyArray<OpenOrderInfo>;
  error?: string;
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
  order_sl?: string;
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

export type SyncResult = {
  account_id: string;
  account_name: string;
  status: 'success' | 'failed';
  error?: string;
  synced_qty?: string;
};

export type SyncResponse = {
  results: ReadonlyArray<SyncResult>;
};

export type OrderFingerprint = {
  symbol: string;
  side: string;
  price: string;
  stop_loss: string;
  take_profit: string;
};

export async function syncCancelApi(params: {
  source_account_id: string;
  source_order_id: string;
  match: OrderFingerprint;
}): Promise<SyncResponse> {
  const res = await fetch('/api/orders/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'cancel', ...params }),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error ?? 'Sync cancel failed');
  }
  return res.json();
}

export async function syncAmendApi(params: {
  source_account_id: string;
  source_order_id: string;
  match: OrderFingerprint;
  price?: string;
  stop_loss?: string;
  take_profit?: string;
  sync_qty_to_risk: boolean;
}): Promise<SyncResponse> {
  const res = await fetch('/api/orders/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'amend', ...params }),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error ?? 'Sync amend failed');
  }
  return res.json();
}
