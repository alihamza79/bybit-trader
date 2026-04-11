import { z } from 'zod/v4';

const riskOverrideSchema = z.object({
  risk_type: z.enum(['percent', 'amount']),
  risk_value: z.number().positive(),
});

export const tradeSchema = z
  .object({
    symbol: z.string().min(1, 'Symbol is required').toUpperCase(),
    side: z.enum(['Buy', 'Sell']),
    order_type: z.enum(['Market', 'Limit']),
    leverage: z.number().int().min(1, 'Min leverage is 1').max(100, 'Max leverage is 100'),
    entry_price: z.number().positive('Must be positive').optional(),
    stop_loss: z.number().positive('Must be positive').optional(),
    take_profit: z.number().positive('Must be positive').optional(),
    account_ids: z.array(z.string().uuid()).optional(),
    risk_overrides: z.record(z.string(), riskOverrideSchema).optional(),
  })
  .refine(
    (data) => data.order_type !== 'Limit' || (data.entry_price !== undefined && data.entry_price > 0),
    { message: 'Entry price is required for Limit orders', path: ['entry_price'] },
  );

export type TradeFormData = z.infer<typeof tradeSchema>;
