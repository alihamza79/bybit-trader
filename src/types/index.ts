export type { Database, Tables, TablesInsert, TablesUpdate } from './database';

export type Account = Tables<'bybit_accounts'>;
export type RiskType = 'percent' | 'amount';
export type AccountInsert = {
  name: string;
  api_key: string;
  api_secret: string;
  risk_type: RiskType;
  risk_amount: number;
  risk_percent?: number | null;
  is_active?: boolean;
};

export type TradeSide = 'Buy' | 'Sell';
export type OrderType = 'Market' | 'Limit';

export type RiskOverride = {
  risk_type: RiskType;
  risk_value: number;
};

export type TradeRequest = {
  symbol: string;
  side: TradeSide;
  order_type: OrderType;
  leverage: number;
  entry_price?: number;
  stop_loss?: number;
  take_profit?: number;
  account_ids?: ReadonlyArray<string>;
  risk_overrides?: Record<string, RiskOverride>;
};

export type AccountExecutionResult = {
  account_id: string;
  account_name: string;
  status: 'success' | 'failed';
  order_id?: string;
  quantity?: string;
  balance?: string;
  error_message?: string;
};

export type TradeResponse = {
  trade_id: string;
  results: ReadonlyArray<AccountExecutionResult>;
};

export type TradeLog = Tables<'trade_logs'>;
export type TradeExecution = Tables<'trade_executions'>;

import type { Tables } from './database';
