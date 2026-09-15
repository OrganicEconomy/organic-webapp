/** Every /api/v1 error response carries { error, code? } (PROTOCOL.md §5) — pulls that message out of an HttpErrorResponse when there is one. */
export function extractServerErrorMessage(err: any): string | null {
  const message = err?.error?.error
  return typeof message === 'string' ? message : null
}
