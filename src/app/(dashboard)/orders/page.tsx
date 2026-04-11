'use client';

import { useState, useRef, useEffect } from 'react';
import { useOpenOrders, useAmendOrder, useCancelOrder } from '@/hooks/useOrders';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { RefreshCw, X, ChevronDown, ChevronRight, Pencil, Check, Link2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

function formatTime(ms: string): string {
  return new Date(parseInt(ms, 10)).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
      <span className="text-muted">{label}: </span>
      <input
        ref={inputRef}
        type="number"
        step={step ?? '0.01'}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-24 rounded border border-primary bg-input-bg px-1.5 py-0.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
      />
      <button type="button" onClick={() => { const n = parseFloat(text); if (!isNaN(n) && n > 0) onSave(text); }} className="text-success hover:text-success/80">
        <Check size={12} />
      </button>
      <button type="button" onClick={onCancel} className="text-muted hover:text-danger">
        <X size={12} />
      </button>
    </div>
  );
}

function InlineSlEditor({
  value,
  onSave,
  onCancel,
}: {
  value: string;
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
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <span className="text-muted">SL: </span>
        <input
          ref={inputRef}
          type="number"
          step="0.01"
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
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={syncRisk}
          onChange={(e) => setSyncRisk(e.target.checked)}
          className="h-3 w-3 rounded border-input-border accent-primary"
        />
        <Link2 size={10} className={syncRisk ? 'text-primary' : 'text-muted'} />
        <span className={`text-[10px] ${syncRisk ? 'text-primary font-medium' : 'text-muted'}`}>
          Sync Qty to keep risk
        </span>
      </label>
    </div>
  );
}

type EditState = {
  orderKey: string;
  field: 'price' | 'qty' | 'sl' | 'tp';
};

export default function OrdersPage(): React.JSX.Element {
  const { data: accountOrders, isLoading, isError, error } = useOpenOrders();
  const amendMutation = useAmendOrder();
  const cancelMutation = useCancelOrder();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editState, setEditState] = useState<EditState | null>(null);

  const totalOrders = accountOrders?.reduce((sum, a) => sum + a.orders.length, 0) ?? 0;
  const accountsWithOrders = accountOrders?.filter((a) => a.orders.length > 0) ?? [];
  const accountsWithErrors = accountOrders?.filter((a) => a.error && a.orders.length === 0) ?? [];

  function toggleAccount(accountId: string): void {
    setCollapsed((prev) => ({ ...prev, [accountId]: !prev[accountId] }));
  }

  function handleCancel(accountId: string, symbol: string, orderId: string): void {
    if (window.confirm('Cancel this order?')) {
      cancelMutation.mutate({ account_id: accountId, symbol, order_id: orderId });
    }
  }

  function handleAmend(
    accountId: string, symbol: string, orderId: string,
    field: 'price' | 'qty' | 'sl' | 'tp', value: string,
  ): void {
    const params: {
      account_id: string; symbol: string; order_id: string;
      qty?: string; price?: string; stop_loss?: string; take_profit?: string;
    } = { account_id: accountId, symbol, order_id: orderId };

    if (field === 'price') params.price = value;
    else if (field === 'qty') params.qty = value;
    else if (field === 'sl') params.stop_loss = value;
    else if (field === 'tp') params.take_profit = value;

    amendMutation.mutate(params, { onSuccess: () => setEditState(null) });
  }

  function handleAmendSlWithSync(
    accountId: string, symbol: string, orderId: string,
    newSl: string, syncRisk: boolean, orderPrice: string, orderSide: string,
  ): void {
    if (syncRisk) {
      amendMutation.mutate({
        account_id: accountId,
        symbol,
        order_id: orderId,
        stop_loss: newSl,
        sync_risk: true,
        order_price: orderPrice,
        order_side: orderSide,
      }, { onSuccess: () => setEditState(null) });
    } else {
      handleAmend(accountId, symbol, orderId, 'sl', newSl);
    }
  }

  function renderEditableField(
    orderKey: string,
    accountId: string,
    symbol: string,
    orderId: string,
    field: 'price' | 'qty' | 'tp',
    label: string,
    currentValue: string,
    hasValue: boolean,
    step?: string,
  ): React.JSX.Element {
    const isEditing = editState?.orderKey === orderKey && editState.field === field;

    if (isEditing) {
      return (
        <InlineFieldEditor
          value={hasValue ? currentValue : ''}
          label={label}
          step={step}
          onSave={(v) => handleAmend(accountId, symbol, orderId, field, v)}
          onCancel={() => setEditState(null)}
        />
      );
    }

    return (
      <button
        type="button"
        onClick={() => setEditState({ orderKey, field })}
        className="group flex items-center gap-1 hover:text-primary transition-colors"
      >
        <span className="text-muted">{label}: </span>
        {hasValue ? (
          <span>{parseFloat(currentValue).toFixed(2)}</span>
        ) : (
          <span className="text-muted/50">Set</span>
        )}
        <Pencil size={10} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Open Orders</h1>
          <p className="text-sm text-muted">
            {totalOrders} pending order{totalOrders !== 1 ? 's' : ''} across {accountsWithOrders.length} account{accountsWithOrders.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['open-orders'] })}
        >
          <RefreshCw size={14} className="mr-1.5" />
          Refresh
        </Button>
      </div>

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

      {accountsWithOrders.length > 0 && (
        <div className="space-y-4">
          {accountsWithOrders.map((acct) => {
            const isCollapsed = collapsed[acct.account_id] ?? false;

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
                      {acct.orders.length} order{acct.orders.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="border-t border-card-border divide-y divide-card-border">
                    {acct.orders.map((order) => {
                      const orderKey = `${acct.account_id}-${order.orderId}`;
                      const hasSl = order.stopLoss && parseFloat(order.stopLoss) > 0;
                      const hasTp = order.takeProfit && parseFloat(order.takeProfit) > 0;
                      const isEditingSl = editState?.orderKey === orderKey && editState.field === 'sl';

                      return (
                        <div key={orderKey} className="px-6 py-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold">{order.symbol}</span>
                                <Badge variant={order.side === 'Buy' ? 'success' : 'danger'}>
                                  {order.side}
                                </Badge>
                                <Badge variant="muted">{order.orderType}</Badge>
                                <Badge variant="primary">{order.orderStatus}</Badge>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-1 text-sm">
                                <div>
                                  {renderEditableField(
                                    orderKey, acct.account_id, order.symbol, order.orderId,
                                    'price', 'Price', order.price, true,
                                  )}
                                </div>
                                <div>
                                  {renderEditableField(
                                    orderKey, acct.account_id, order.symbol, order.orderId,
                                    'qty', 'Qty', order.qty, true, '0.001',
                                  )}
                                </div>
                                <div>
                                  <span className="text-muted">Filled: </span>
                                  <span>{order.cumExecQty} / {order.qty}</span>
                                </div>
                                <div>
                                  <span className="text-muted">Created: </span>
                                  <span>{formatTime(order.createdTime)}</span>
                                </div>
                                <div>
                                  {isEditingSl ? (
                                    <InlineSlEditor
                                      value={hasSl ? order.stopLoss : ''}
                                      onSave={(v, sync) => handleAmendSlWithSync(
                                        acct.account_id, order.symbol, order.orderId,
                                        v, sync, order.price, order.side,
                                      )}
                                      onCancel={() => setEditState(null)}
                                    />
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setEditState({ orderKey, field: 'sl' })}
                                      className="group flex items-center gap-1 hover:text-primary transition-colors"
                                    >
                                      <span className="text-muted">SL: </span>
                                      {hasSl ? (
                                        <span>{parseFloat(order.stopLoss).toFixed(2)}</span>
                                      ) : (
                                        <span className="text-muted/50">Set</span>
                                      )}
                                      <Pencil size={10} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                  )}
                                </div>
                                <div>
                                  {renderEditableField(
                                    orderKey, acct.account_id, order.symbol, order.orderId,
                                    'tp', 'TP', order.takeProfit, Boolean(hasTp),
                                  )}
                                </div>
                              </div>

                              {(hasSl || hasTp) && (() => {
                                const qty = parseFloat(order.qty);
                                const price = parseFloat(order.price);
                                const sl = parseFloat(order.stopLoss);
                                const tp = parseFloat(order.takeProfit);
                                const isLong = order.side === 'Buy';

                                const estLoss = hasSl
                                  ? qty * (isLong ? price - sl : sl - price)
                                  : null;
                                const estProfit = hasTp
                                  ? qty * (isLong ? tp - price : price - tp)
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

                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleCancel(acct.account_id, order.symbol, order.orderId)}
                              loading={cancelMutation.isPending}
                            >
                              <X size={14} className="mr-1" />
                              Cancel
                            </Button>
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
