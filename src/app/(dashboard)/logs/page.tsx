'use client';

import { useTradeLogs } from '@/hooks/useTrades';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CheckCircle, XCircle } from 'lucide-react';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LogsPage(): React.JSX.Element {
  const { data: logs, isLoading, isError, error } = useTradeLogs();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold">Trade Logs</h1>
        <p className="text-sm text-muted">History of executed trades</p>
      </div>

      {isLoading && (
        <Card className="text-center text-sm text-muted">Loading trade logs...</Card>
      )}

      {isError && (
        <Card className="text-center text-sm text-danger">
          {error instanceof Error ? error.message : 'Failed to load logs'}
        </Card>
      )}

      {logs && logs.length === 0 && (
        <Card className="text-center text-sm text-muted">
          No trades executed yet.
        </Card>
      )}

      {logs && logs.length > 0 && (
        <div className="space-y-4">
          {logs.map((log) => {
            const successCount = log.trade_executions.filter((e) => e.status === 'success').length;
            const failCount = log.trade_executions.filter((e) => e.status === 'failed').length;

            return (
              <Card key={log.id}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-semibold">{log.symbol}</span>
                    <Badge variant={log.side === 'Buy' ? 'success' : 'danger'}>
                      {log.side}
                    </Badge>
                    <Badge variant="primary">{log.leverage}x</Badge>
                    <Badge variant="muted">{log.order_type}</Badge>
                  </div>
                  <span className="text-xs text-muted">{formatDate(log.created_at)}</span>
                </div>

                <div className="mb-3 flex gap-4 text-xs text-muted">
                  {log.entry_price !== null && <span>Entry: {log.entry_price}</span>}
                  {log.stop_loss !== null && <span>SL: {log.stop_loss}</span>}
                  {log.take_profit !== null && <span>TP: {log.take_profit}</span>}
                </div>

                <div className="space-y-2">
                  {log.trade_executions.map((exec) => (
                    <div
                      key={exec.id}
                      className="flex items-center justify-between rounded-lg bg-input-bg px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        {exec.status === 'success' ? (
                          <CheckCircle size={14} className="text-success" />
                        ) : (
                          <XCircle size={14} className="text-danger" />
                        )}
                        <span>{exec.account_name}</span>
                      </div>
                      <div className="text-xs text-muted">
                        {exec.status === 'success'
                          ? `Qty: ${exec.quantity}`
                          : exec.error_message}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 text-xs text-muted">
                  {successCount} succeeded, {failCount} failed
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
