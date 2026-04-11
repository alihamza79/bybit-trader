import { delay } from './delay';

const RETRYABLE_PATTERNS = [
  'ENOTFOUND',
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'socket hang up',
  'network',
  'timeout',
  'fetch failed',
] as const;

export function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.msg === 'string') return obj.msg;
    if (typeof obj.retMsg === 'string') return obj.retMsg;
    if (typeof obj.error === 'string') return obj.error;
    try {
      return JSON.stringify(err);
    } catch {
      return '[unknown error object]';
    }
  }
  return String(err);
}

function isRetryable(err: unknown): boolean {
  const msg = extractErrorMessage(err);
  return RETRYABLE_PATTERNS.some((p) => msg.toLowerCase().includes(p.toLowerCase()));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;

      if (attempt < maxAttempts && isRetryable(err)) {
        const waitMs = baseDelayMs * Math.pow(2, attempt - 1);
        console.warn(
          `[retry] Attempt ${attempt}/${maxAttempts} failed (${extractErrorMessage(err)}), retrying in ${waitMs}ms...`,
        );
        await delay(waitMs);
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}
