import { InvalidTransactionError } from 'organic-money/src/errors.js';

/** Every /api/v1 error response carries { error, code? } (PROTOCOL.md §5) — pulls that message out of an HttpErrorResponse when there is one. */
export function extractServerErrorMessage(err: any): string | null {
  const message = err?.error?.error
  return typeof message === 'string' ? message : null
}

/** organic-money throws this when a transaction's signature already appears in recent history — e.g. the exact same role change repeated the same day. */
export function isDuplicateTransactionError(err: unknown): boolean {
  return err instanceof InvalidTransactionError && err.message.startsWith('Transaction duplicate')
}
