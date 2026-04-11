'use client';

import { useState, useRef, useEffect } from 'react';
import {
  useOpenOrders,
  useAmendOrder,
  useCancelOrder,
  useSyncCancel,
  useSyncAmend,
} from '@/hooks/useOrders';
import type { SyncResponse } from '@/hooks/useOrders';
import type { OpenOrderInfo } from '@/lib/bybit';
import type { OrderFingerprint } from '@/lib/api/orders';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  RefreshCw, X, ChevronDown, ChevronRight, Pencil, Check,
  Link2, Link2Off, CheckCircle, XCircle,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

function formatTime(ms: string): string {
  return new Date(parseInt(ms, 10)).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function orderFingerprint(order: OpenOrderInfo): OrderFingerprint {
  return {
    symbol: order.symbol,
    side: order.side,
    price: order.price,
    stop_loss: order.stopLoss,
    take_profit: order.takeProfit,
  };
}

// Shared inline editor for fields that support "Adjust qty to keep risk"
function InlineRiskAwareEditor({
  value,
  label,
  step,
  showSyncRisk,
  onSave,
  onCancel,
}: {
  value: string;
  label: string;
  step?: string;
  showSyncRisk: boolean;
  onSave: (v: string, syncRisk: boolean) => void;
  onCancel: () => void;
}): React.JSX.Element {
  const [text, setText] = useState(value);
  const [syncRisk, setSyncRisk] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function handleSubmit(): void {
    const num = parseFloat(text);
    if (!isNaN(num) && num > 0) onSave(text, syncRisk);
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') onCancel();
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <span className="text-[11px] text-muted">{label}</span>
        <input
          ref={inputRef}
          type="number"
          step={step ?? '0.01'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-24 rounded border border-primary bg-input-bg px-1.5 py-0.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <button type="button" onClick={handleSubmit} className="text-success hover:text-success/80">
          <Check size={12} />
        </button>
        <button type="button" onClick={onCancel} className="text-muted hover:text-danger">
          <X size={12} />
        </button>
      </div>
      {showSyncRisk && (
        <label className="flex items-center gap-1.5 cursor-pointer ml-1">
          <input
            type="checkbox"
            checked={syncRisk}
            onChange={(e) => setSyncRisk(e.target.checked)}
            className="h-3 w-3 rounded border-input-border accent-primary"
          />
          <Link2 size={10} className={syncRisk ? 'text-primary' : 'text-muted'} />
          <span className={`text-[10px] ${syncRisk ? 'text-primary font-medium' : 'text-muted'}`}>
            Adjust qty to keep risk
          </span>
        </label>
      )}
    </div>
  );
}

function InlineFieldEditor({
  value,
  label,
  step,
  onSave,
  onCancel,
}: {
  value: string;
  label: string;
  step?: string;
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
      if (!isNaN(num) && num > 0) onSave(text);
    }
    if (e.key === 'Escape') onCancel();
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-[11px] text-muted">{label}</span>
      <input
        ref={inputRef}
        type="number"
        step={step ?? '0.01'}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-24 rounded border border-primary bg-input-bg px-1.5 py-0.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
      />
      <button
        type="button"
        onClick={() => { const n = parseFloat(text); if (!isNaN(n) && n > 0) onSave(text); }}
        className="text-success hover:text-success/80"
      >
        <Check size={12} />
      </button>
      <button type="button" onClick={onCancel} className="text-muted hover:text-danger">
        <X size={12} />
      </button>
    </div>
  );
}

type EditState = {
  orderKey: string;
  field: 'price' | 'qty' | 'sl' | 'tp';
};

type SyncFeedback = {
  results: SyncResponse['results'];
  action: string;
  timestamp: number;
};

export default function OrdersPage(): React.JSX.Element {
  const { data: accountOrders, isLoading, isError, error } = useOpenOrders();
  const amendMutation = useAmendOrder();
  const cancelMutation = useCancelOrder();
  const syncCancelMutation = useSyncCancel();
  const syncAmendMutation = useSyncAmend();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editState, setEditState] = useState<EditState | null>(null);
  const [syncMode, setSyncMode] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<SyncFeedback | null>(null);

  const totalOrders = accountOrders?.reduce((sum, a) => sum + a.orders.length, 0) ?? 0;
  const accountsWithOrders = accountOrders?.filter((a) => a.orders.length > 0) ?? [];
  const accountsWithErrors = accountOrders?.filter((a) => a.error && a.orders.length === 0) ?? [];

  useEffect(() => {
    if (syncFeedback) {
      const timer = setTimeout(() => setSyncFeedback(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [syncFeedback]);

  function toggleAccount(accountId: string): void {
    setCollapsed((prev) => ({ ...prev, [accountId]: !prev[accountId] }));
  }

  // --- Single-account actions ---

  function handleCancel(accountId: string, symbol: string, orderId: string): void {
    if (window.confirm('Cancel this order?')) {
      cancelMutation.mutate({ account_id: accountId, symbol, order_id: orderId });
    }
  }

  function handleAmend(
    accountId: string, order: OpenOrderInfo,
    field: 'price' | 'qty' | 'sl' | 'tp', value: string,
    syncRisk?: boolean,
  ): void {
    const params: {
      account_id: string; symbol: string; order_id: string;
      qty?: string; price?: string; stop_loss?: string; take_profit?: string;
      sync_risk?: boolean; order_price?: string; order_side?: string; order_sl?: string;
    } = { account_id: accountId, symbol: order.symbol, order_id: order.orderId };

    if (field === 'price') params.price = value;
    else if (field === 'qty') params.qty = value;
    else if (field === 'sl') params.stop_loss = value;
    else if (field === 'tp') params.take_profit = value;

    if (syncRisk) {
      params.sync_risk = true;
      params.order_price = order.price;
      params.order_side = order.side;
      params.order_sl = order.stopLoss;
    }

    amendMutation.mutate(params, { onSuccess: () => setEditState(null) });
  }

  // --- Sync actions (propagate to all accounts) ---

  function handleSyncCancel(
    sourceAccountId: string, sourceOrderId: string, order: OpenOrderInfo,
  ): void {
    const count = accountsWithOrders.length;
    if (!window.confirm(
      `Cancel the matching "${order.symbol}" ${order.side} order across ${count} account${count !== 1 ? 's' : ''}?`,
    )) return;

    syncCancelMutation.mutate(
      {
        source_account_id: sourceAccountId,
        source_order_id: sourceOrderId,
        match: orderFingerprint(order),
      },
      {
        onSuccess: (data) => {
          setSyncFeedback({ results: data.results, action: `Cancel ${order.symbol}`, timestamp: Date.now() });
        },
      },
    );
  }

  function handleSyncAmend(
    sourceAccountId: string, sourceOrderId: string, order: OpenOrderInfo,
    field: 'price' | 'sl' | 'tp', value: string, syncQty: boolean,
  ): void {
    const params: Parameters<typeof syncAmendMutation.mutate>[0] = {
      source_account_id: sourceAccountId,
      source_order_id: sourceOrderId,
      match: orderFingerprint(order),
      sync_qty_to_risk: syncQty,
    };

    if (field === 'price') params.price = value;
    else if (field === 'sl') params.stop_loss = value;
    else if (field === 'tp') params.take_profit = value;

    syncAmendMutation.mutate(params, {
      onSuccess: (data) => {
        setSyncFeedback({
          results: data.results,
          action: `Amend ${field.toUpperCase()} on ${order.symbol}`,
          timestamp: Date.now(),
        });
        setEditState(null);
      },
    });
  }

  const isMutating = amendMutation.isPending || cancelMutation.isPending
    || syncCancelMutation.isPending || syncAmendMutation.isPending;

  function renderOrderCard(
    accountId: string,
    order: OpenOrderInfo,
  ): React.JSX.Element {
    const orderKey = `${accountId}-${order.orderId}`;
    const hasSl = order.stopLoss && parseFloat(order.stopLoss) > 0;
    const hasTp = order.takeProfit && parseFloat(order.takeProfit) > 0;
    const isEditingPrice = editState?.orderKey === orderKey && editState.field === 'price';
    const isEditingSl = editState?.orderKey === orderKey && editState.field === 'sl';
    const isEditingTp = editState?.orderKey === orderKey && editState.field === 'tp';
    const isEditingQty = editState?.orderKey === orderKey && editState.field === 'qty';

    const qty = parseFloat(order.qty);
    const price = parseFloat(order.price);
    const sl = parseFloat(order.stopLoss);
    const tp = parseFloat(order.takeProfit);
    const isLong = order.side === 'Buy';
    const estLoss = hasSl ? qty * (isLong ? price - sl : sl - price) : null;
    const estProfit = hasTp ? qty * (isLong ? tp - price : price - tp) : null;

    function editableButton(field: EditState['field'], label: string, displayVal: string | null): React.JSX.Element {
      return (
        <button
          type="button"
          onClick={() => setEditState({ orderKey, field })}
          className="group flex items-center gap-1 hover:text-primary transition-colors text-sm"
        >
          <span className="text-[11px] text-muted">{label}</span>
          {displayVal ? (
            <span className="font-mono">{displayVal}</span>
          ) : (
            <span className="text-muted/50 italic text-xs">Set</span>
          )}
          <Pencil size={9} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      );
    }

    return (
      <div key={orderKey} className="px-5 py-3.5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            {/* Top line: symbol + badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-semibold text-sm">{order.symbol}</span>
              <Badge variant={order.side === 'Buy' ? 'success' : 'danger'}>{order.side}</Badge>
              <Badge variant="muted">{order.orderType}</Badge>
              <Badge variant="primary">{order.orderStatus}</Badge>
              {syncMode && (
                <Link2 size={11} className="text-primary" />
              )}
            </div>

            {/* Fields */}
            <div className="flex flex-wrap items-start gap-x-5 gap-y-1.5 text-sm">
              {/* Price — with sync risk option */}
              {isEditingPrice ? (
                <InlineRiskAwareEditor
                  value={order.price}
                  label="Price"
                  showSyncRisk={true}
                  onSave={(v, syncRisk) => {
                    if (syncMode) {
                      handleSyncAmend(accountId, order.orderId, order, 'price', v, syncRisk);
                    } else {
                      handleAmend(accountId, order, 'price', v, syncRisk || undefined);
                    }
                  }}
                  onCancel={() => setEditState(null)}
                />
              ) : (
                editableButton('price', 'Price', parseFloat(order.price).toFixed(2))
              )}

              {/* Qty — plain editor, no sync */}
              {isEditingQty ? (
                <InlineFieldEditor
                  value={order.qty}
                  label="Qty"
                  step="0.001"
                  onSave={(v) => handleAmend(accountId, order, 'qty', v)}
                  onCancel={() => setEditState(null)}
                />
              ) : (
                editableButton('qty', 'Qty', order.qty)
              )}

              <span className="text-sm">
                <span className="text-[11px] text-muted">Filled</span>{' '}
                <span className="font-mono">{order.cumExecQty}/{order.qty}</span>
              </span>

              {/* SL — with sync risk option */}
              {isEditingSl ? (
                <InlineRiskAwareEditor
                  value={hasSl ? order.stopLoss : ''}
                  label="SL"
                  showSyncRisk={true}
                  onSave={(v, syncRisk) => {
                    if (syncMode) {
                      handleSyncAmend(accountId, order.orderId, order, 'sl', v, syncRisk);
                    } else {
                      handleAmend(accountId, order, 'sl', v, syncRisk || undefined);
                    }
                  }}
                  onCancel={() => setEditState(null)}
                />
              ) : (
                editableButton('sl', 'SL', hasSl ? sl.toFixed(2) : null)
              )}

              {/* TP — plain for sync, no risk adjustment needed */}
              {isEditingTp ? (
                <InlineFieldEditor
                  value={hasTp ? order.takeProfit : ''}
                  label="TP"
                  onSave={(v) => {
                    if (syncMode) {
                      handleSyncAmend(accountId, order.orderId, order, 'tp', v, false);
                    } else {
                      handleAmend(accountId, order, 'tp', v);
                    }
                  }}
                  onCancel={() => setEditState(null)}
                />
              ) : (
                editableButton('tp', 'TP', hasTp ? tp.toFixed(2) : null)
              )}

              <span className="text-sm">
                <span className="text-[11px] text-muted">Time</span>{' '}
                <span>{formatTime(order.createdTime)}</span>
              </span>
            </div>

            {/* P&L estimates */}
            {(estLoss !== null || estProfit !== null) && (
              <div className="flex items-center gap-3 text-xs">
                {estLoss !== null && (
                  <span className="text-danger">Loss: -{Math.abs(estLoss).toFixed(2)}</span>
                )}
                {estProfit !== null && (
                  <span className="text-success">Profit: +{Math.abs(estProfit).toFixed(2)}</span>
                )}
                {estLoss !== null && estProfit !== null && Math.abs(estLoss) > 0 && (
                  <span className="text-muted">R:R {(Math.abs(estProfit) / Math.abs(estLoss)).toFixed(1)}</span>
                )}
              </div>
            )}
          </div>

          {/* Cancel button */}
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (syncMode) {
                handleSyncCancel(accountId, order.orderId, order);
              } else {
                handleCancel(accountId, order.symbol, order.orderId);
              }
            }}
            loading={cancelMutation.isPending || syncCancelMutation.isPending}
            className="shrink-0"
          >
            <X size={14} className="mr-1" />
            {syncMode ? 'Cancel All' : 'Cancel'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Open Orders</h1>
          <p className="text-sm text-muted">
            {totalOrders} order{totalOrders !== 1 ? 's' : ''} across {accountsWithOrders.length} account{accountsWithOrders.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Sync toggle */}
          <button
            type="button"
            onClick={() => setSyncMode((prev) => !prev)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
              syncMode
                ? 'border-primary bg-primary/10 text-primary shadow-sm shadow-primary/20'
                : 'border-card-border text-muted hover:text-foreground hover:border-input-border'
            }`}
          >
            {syncMode ? <Link2 size={14} /> : <Link2Off size={14} />}
            {syncMode ? 'Synced' : 'Sync Off'}
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['open-orders'] })}
          >
            <RefreshCw size={14} className="mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Sync mode banner */}
      {syncMode && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <Link2 size={16} className="text-primary mt-0.5 shrink-0" />
          <div className="text-xs text-muted leading-relaxed">
            <span className="font-medium text-primary">Sync mode active.</span>{' '}
            Actions on any order will be mirrored to the matching order (same symbol, side, price, SL, TP) on every other account.
            Check &quot;Adjust qty to keep risk&quot; when editing Price or SL to recalculate quantity per account.
          </div>
        </div>
      )}

      {/* Sync feedback toast */}
      {syncFeedback && (
        <div className="mb-4 rounded-lg border border-card-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-primary" />
              <span className="text-sm font-medium">{syncFeedback.action}</span>
            </div>
            <button
              type="button"
              onClick={() => setSyncFeedback(null)}
              className="text-muted hover:text-foreground"
            >
              <X size={14} />
            </button>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {syncFeedback.results.map((r) => (
              <div key={r.account_id} className="flex items-center gap-1.5 text-xs">
                {r.status === 'success' ? (
                  <CheckCircle size={12} className="text-success shrink-0" />
                ) : (
                  <XCircle size={12} className="text-danger shrink-0" />
                )}
                <span className="font-medium truncate">{r.account_name}</span>
                {r.error && <span className="text-danger truncate">— {r.error}</span>}
                {r.synced_qty && <span className="text-muted">(qty: {r.synced_qty})</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading / Error states */}
      {isLoading && (
        <Card className="text-center text-sm text-muted">Loading open orders...</Card>
      )}

      {isError && (
        <Card className="text-center text-sm text-danger">
          {error instanceof Error ? error.message : 'Failed to load orders'}
        </Card>
      )}

      {accountOrders && totalOrders === 0 && accountsWithErrors.length === 0 && (
        <Card className="text-center text-sm text-muted">
          No open orders across any account.
        </Card>
      )}

      {/* Account-level errors */}
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

      {/* Orders grouped by account (always) */}
      {accountsWithOrders.length > 0 && (
        <div className="space-y-4">
          {accountsWithOrders.map((acct) => {
            const isCollapsed = collapsed[acct.account_id] ?? false;

            return (
              <div
                key={acct.account_id}
                className={`rounded-xl border bg-card overflow-hidden ${
                  syncMode ? 'border-primary/20' : 'border-card-border'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleAccount(acct.account_id)}
                  className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-input-bg/50 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    {isCollapsed
                      ? <ChevronRight size={16} className="text-muted" />
                      : <ChevronDown size={16} className="text-muted" />
                    }
                    <span className="font-semibold">{acct.account_name}</span>
                    <Badge variant="muted">
                      {acct.orders.length} order{acct.orders.length !== 1 ? 's' : ''}
                    </Badge>
                    {syncMode && <Link2 size={12} className="text-primary" />}
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="border-t border-card-border divide-y divide-card-border">
                    {acct.orders.map((order) =>
                      renderOrderCard(acct.account_id, order),
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Mutation loading indicator */}
      {isMutating && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border border-card-border bg-card px-4 py-2.5 shadow-lg">
          <RefreshCw size={14} className="animate-spin text-primary" />
          <span className="text-sm text-muted">Processing...</span>
        </div>
      )}
    </div>
  );
}
