import type { TradeRequest, TradeResponse, TradeLog, TradeExecution } from '@/types';

export async function executeTrade(data: TradeRequest): Promise<TradeResponse> {
  const res = await fetch('/api/trade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error ?? 'Trade execution failed');
  }
  return res.json();
}

export type TradeLogWithExecutions = TradeLog & {
  trade_executions: ReadonlyArray<TradeExecution>;
};

export async function fetchTradeLogs(): Promise<ReadonlyArray<TradeLogWithExecutions>> {
  const res = await fetch('/api/trade');
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error ?? 'Failed to fetch trade logs');
  }
  return res.json();
}
