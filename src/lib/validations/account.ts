import { z } from 'zod/v4';

export const accountSchema = z
  .object({
    name: z.string().min(1, 'Account name is required').max(100),
    api_key: z.string().min(1, 'API key is required'),
    api_secret: z.string().min(1, 'API secret is required'),
    risk_type: z.enum(['percent', 'amount']),
    risk_percent: z.number().min(0.1).max(100).optional().nullable(),
    risk_amount: z.number().min(1).max(1_000_000).optional().nullable(),
    proxy_url: z.string().url('Must be a valid URL').optional().nullable().or(z.literal('')),
  })
  .refine(
    (data) =>
      data.risk_type !== 'percent' || (data.risk_percent != null && data.risk_percent > 0),
    { message: 'Risk percentage is required', path: ['risk_percent'] },
  )
  .refine(
    (data) =>
      data.risk_type !== 'amount' || (data.risk_amount != null && data.risk_amount > 0),
    { message: 'Risk amount is required', path: ['risk_amount'] },
  );

export type AccountFormData = z.infer<typeof accountSchema>;
