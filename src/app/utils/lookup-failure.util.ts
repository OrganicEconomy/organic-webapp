import { HttpErrorResponse } from '@angular/common/http';

export type LookupFailure = 'unknown' | 'unreachable' | 'server-error';

export function lookupFailure(error: HttpErrorResponse): LookupFailure {
  if (error.status === 404) {
    return 'unknown';
  }
  if (error.status === 0) {
    return 'unreachable';
  }
  return 'server-error';
}
