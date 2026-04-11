'use client';

import { useState, useRef, useEffect } from 'react';
import { usePositions, useClosePosition, useUpdatePositionTpSl } from '@/hooks/usePositions';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { RefreshCw, X, ChevronDown, ChevronRight, Pencil, Check } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

const CLOSE_PERCENTS = [25, 50, 75, 100] as const;

function calcPartialSize(fullSize: string, percent: number): string {
  const size = parseFloat(fullSize);
  if (percent === 100) return fullSize;

  const partial = size * (percent / 100);
  const precision = fullSize.split('.')[1]?.length ?? 0;
  const step = Math.pow(10, -precision);
  const rounded = Math.floor(partial / step) * step;
  return rounded.toFixed(precision);
}

type CloseState = { key: string; percent: number };

function InlinePriceEditor({
  value,
  label,
  onSave,
  onCancel,
}: {
  value: string;
  label: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}): React.JSX.Element {
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter') {
      const num = parseFloat(text);
      if (!isNaN(num) && num >= 0) onSave(text);
    }
    if (e.key === 'Escape') onCancel();
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-muted">{label}: </span>
      <input
        ref={inputRef}
        type="number"
        step="0.01"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-24 rounded border border-primary bg-input-bg px-1.5 py-0.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
      />
      <button type="button" onClick={() => { const n = parseFloat(text); if (!isNaN(n) && n >= 0) onSave(text); }} className="text-success hover:text-success/80">
        <Check size={12} />
      </button>
      <button type="button" onClick={onCancel} className="text-muted hover:text-danger">
        <X size={12} />
      </button>
    </div>
  );
}

type EditField = { key: string; field: 'sl' | 'tp' };

export default function PositionsPage(): React.JSX.Element {
  const { data: accountPositions, isLoading, isError, error } = usePositions();
  const closeMutation = useClosePosition();
  const tpSlMutation = useUpdatePositionTpSl();
  const queryClient = useQueryClient();
  const [closeState, setCloseState] = useState<CloseState | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editField, setEditField] = useState<EditField | null>(null);

  const totalPositions = accountPositions?.reduce((sum, a) => sum + a.positions.length, 0) ?? 0;
  const accountsWithPositions = accountPositions?.filter((a) => a.positions.length > 0) ?? [];
  const accountsWithErrors = accountPositions?.filter((a) => a.error && a.positions.length === 0) ?? [];

  function posKey(accountId: string, symbol: string, side: string): string {
    return `${accountId}-${symbol}-${side}`;
  }

  function toggleAccount(accountId: string): void {
    setCollapsed((prev) => ({ ...prev, [accountId]: !prev[accountId] }));
  }

  function handleSelectPercent(accountId: string, symbol: string, side: string, percent: number): void {
    const key = posKey(accountId, symbol, side);
    setCloseState((prev) =>
      prev?.key === key && prev.percent === percent ? null : { key, percent },
    );
  }

  function handleClose(accountId: string, symbol: string, side: string, fullSize: string): void {
    const key = posKey(accountId, symbol, side);
    const percent = closeState?.key === key ? closeState.percent : 100;
    const closeSize = calcPartialSize(fullSize, percent);

    if (parseFloat(closeSize) <= 0) return;

    closeMutation.mutate(
      { account_id: accountId, symbol, side, size: closeSize },
      { onSuccess: () => setCloseState(null) },
    );
  }

  function handleSaveTpSl(
    accountId: string, symbol: string, positionIdx: 0 | 1 | 2,
    field: 'sl' | 'tp', value: string, currentSl: string, currentTp: string,
  ): void {
    const params: {
      account_id: string; symbol: string; position_idx: 0 | 1 | 2;
      stop_loss?: string; take_profit?: string;
    } = { account_id: accountId, symbol, position_idx: positionIdx };

    if (field === 'sl') {
      params.stop_loss = value;
      if (currentTp && parseFloat(currentTp) > 0) params.take_profit = currentTp;
    } else {
      params.take_profit = value;
      if (currentSl && parseFloat(currentSl) > 0) params.stop_loss = currentSl;
    }

    tpSlMutation.mutate(params, { onSuccess: () => setEditField(null) });
  }

  function accountTotalPnl(positions: ReadonlyArray<{ unrealisedPnl: string }>): number {
    return positions.reduce((sum, p) => sum + parseFloat(p.unrealisedPnl), 0);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Open Positions</h1>
          <p className="text-sm text-muted">
            {totalPositions} position{totalPositions !== 1 ? 's' : ''} across {accountsWithPositions.length} account{accountsWithPositions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['positions'] })}
        >
          <RefreshCw size={14} className="mr-1.5" />
          Refresh
        </Button>
      </div>

      {isLoading && (
        <Card className="text-center text-sm text-muted">Loading positions...</Card>
      )}

      {isError && (
        <Card className="text-center text-sm text-danger">
          {error instanceof Error ? error.message : 'Failed to load positions'}
        </Card>
      )}

      {accountPositions && totalPositions === 0 && accountsWithErrors.length === 0 && (
        <Card className="text-center text-sm text-muted">
          No open positions across any account.
        </Card>
      )}

      {accountsWithErrors.length > 0 && (
        <div className="space-y-2 mb-4">
          {accountsWithErrors.map((acct) => (
            <Card key={acct.account_id} className="border-l-4 border-l-danger text-sm">
              <span className="font-medium">{acct.account_name}</span>
              <span className="text-danger ml-2">{acct.error}</span>
            </Card>
          ))}
        </div>
      )}

      {accountsWithPositions.length > 0 && (
        <div className="space-y-4">
          {accountsWithPositions.map((acct) => {
            const isCollapsed = collapsed[acct.account_id] ?? false;
            const totalPnl = accountTotalPnl(acct.positions);
            const pnlColor = totalPnl >= 0 ? 'text-success' : 'text-danger';

            return (
              <div key={acct.account_id} className="rounded-xl border border-card-border bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleAccount(acct.account_id)}
                  className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-input-bg/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isCollapsed ? <ChevronRight size={18} className="text-muted" /> : <ChevronDown size={18} className="text-muted" />}
                    <span className="font-semibold">{acct.account_name}</span>
                    <Badge variant="muted">
                      {acct.positions.length} position{acct.positions.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <span className={`text-sm font-medium ${pnlColor}`}>
                    {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)} USDT
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="border-t border-card-border divide-y divide-card-border">
                    {acct.positions.map((pos) => {
                      const pnl = parseFloat(pos.unrealisedPnl);
                      const posColor = pnl >= 0 ? 'text-success' : 'text-danger';
                      const key = posKey(acct.account_id, pos.symbol, pos.side);
                      const selectedPercent = closeState?.key === key ? closeState.percent : null;
                      const closeSize = selectedPercent
                        ? calcPartialSize(pos.size, selectedPercent)
                        : pos.size;

                      const hasSl = pos.stopLoss && parseFloat(pos.stopLoss) > 0;
                      const hasTp = pos.takeProfit && parseFloat(pos.takeProfit) > 0;
                      const isEditingSl = editField?.key === key && editField.field === 'sl';
                      const isEditingTp = editField?.key === key && editField.field === 'tp';

                      return (
                        <div key={key} className="px-6 py-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold">{pos.symbol}</span>
                                <Badge variant={pos.side === 'Buy' ? 'success' : 'danger'}>
                                  {pos.side === 'Buy' ? 'Long' : 'Short'}
                                </Badge>
                                <Badge variant="primary">{pos.leverage}x</Badge>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-1 text-sm">
                                <div>
                                  <span className="text-muted">Size: </span>
                                  <span>{pos.size}</span>
                                </div>
                                <div>
                                  <span className="text-muted">Entry: </span>
                                  <span>{parseFloat(pos.entryPrice).toFixed(2)}</span>
                                </div>
                                <div>
                                  <span className="text-muted">Mark: </span>
                                  <span>{parseFloat(pos.markPrice).toFixed(2)}</span>
                                </div>
                                <div>
                                  <span className="text-muted">PnL: </span>
                                  <span className={posColor}>
                                    {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} USDT
                                  </span>
                                </div>
                                {pos.liqPrice && parseFloat(pos.liqPrice) > 0 && (
                                  <div>
                                    <span className="text-muted">Liq: </span>
                                    <span className="text-danger">{parseFloat(pos.liqPrice).toFixed(2)}</span>
                                  </div>
                                )}

                                <div>
                                  {isEditingSl ? (
                                    <InlinePriceEditor
                                      value={hasSl ? pos.stopLoss : ''}
                                      label="SL"
                                      onSave={(v) => handleSaveTpSl(acct.account_id, pos.symbol, pos.positionIdx, 'sl', v, pos.stopLoss, pos.takeProfit)}
                                      onCancel={() => setEditField(null)}
                                    />
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setEditField({ key, field: 'sl' })}
                                      className="group flex items-center gap-1 hover:text-primary transition-colors"
                                    >
                                      <span className="text-muted">SL: </span>
                                      {hasSl ? (
                                        <span>{parseFloat(pos.stopLoss).toFixed(2)}</span>
                                      ) : (
                                        <span className="text-muted/50">Set</span>
                                      )}
                                      <Pencil size={10} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                  )}
                                </div>

                                <div>
                                  {isEditingTp ? (
                                    <InlinePriceEditor
                                      value={hasTp ? pos.takeProfit : ''}
                                      label="TP"
                                      onSave={(v) => handleSaveTpSl(acct.account_id, pos.symbol, pos.positionIdx, 'tp', v, pos.stopLoss, pos.takeProfit)}
                                      onCancel={() => setEditField(null)}
                                    />
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setEditField({ key, field: 'tp' })}
                                      className="group flex items-center gap-1 hover:text-primary transition-colors"
                                    >
                                      <span className="text-muted">TP: </span>
                                      {hasTp ? (
                                        <span>{parseFloat(pos.takeProfit).toFixed(2)}</span>
                                      ) : (
                                        <span className="text-muted/50">Set</span>
                                      )}
                                      <Pencil size={10} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {(hasSl || hasTp) && (() => {
                                const qty = parseFloat(pos.size);
                                const entry = parseFloat(pos.entryPrice);
                                const sl = parseFloat(pos.stopLoss);
                                const tp = parseFloat(pos.takeProfit);
                                const isLong = pos.side === 'Buy';

                                const estLoss = hasSl
                                  ? qty * (isLong ? entry - sl : sl - entry)
                                  : null;
                                const estProfit = hasTp
                                  ? qty * (isLong ? tp - entry : entry - tp)
                                  : null;

                                return (
                                  <div className="flex items-center gap-4 mt-1.5 text-xs">
                                    {estLoss !== null && (
                                      <span className="text-danger">
                                        Est. Loss: -{Math.abs(estLoss).toFixed(2)} USDT
                                      </span>
                                    )}
                                    {estProfit !== null && (
                                      <span className="text-success">
                                        Est. Profit: +{Math.abs(estProfit).toFixed(2)} USDT
                                      </span>
                                    )}
                                    {estLoss !== null && estProfit !== null && Math.abs(estLoss) > 0 && (
                                      <span className="text-muted">
                                        R:R {(Math.abs(estProfit) / Math.abs(estLoss)).toFixed(1)}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 border-t border-card-border pt-3">
                            <span className="text-xs text-muted mr-1">Close:</span>
                            {CLOSE_PERCENTS.map((pct) => (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => handleSelectPercent(acct.account_id, pos.symbol, pos.side, pct)}
                                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                                  selectedPercent === pct
                                    ? 'bg-danger text-white'
                                    : 'bg-input-bg text-muted hover:text-foreground'
                                }`}
                              >
                                {pct}%
                              </button>
                            ))}

                            {selectedPercent && (
                              <>
                                <span className="ml-2 text-xs text-muted">
                                  {closeSize} {pos.symbol.replace('USDT', '')}
                                </span>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  className="ml-auto"
                                  onClick={() => handleClose(acct.account_id, pos.symbol, pos.side, pos.size)}
                                  loading={closeMutation.isPending}
                                >
                                  <X size={14} className="mr-1" />
                                  Close {selectedPercent}%
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
