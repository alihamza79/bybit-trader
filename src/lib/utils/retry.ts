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
] as const;

function isRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
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
          `[retry] Attempt ${attempt}/${maxAttempts} failed (${err instanceof Error ? err.message : err}), retrying in ${waitMs}ms...`,
        );
        await delay(waitMs);
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}
