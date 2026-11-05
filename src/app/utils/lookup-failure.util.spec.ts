import { HttpErrorResponse } from '@angular/common/http';
import { lookupFailure } from './lookup-failure.util';

describe('lookupFailure', () => {
  it('should call a 404 an unknown key', () => {
    expect(lookupFailure(new HttpErrorResponse({ status: 404 }))).toBe('unknown');
  });

  it('should call a status 0 an unreachable server', () => {
    expect(lookupFailure(new HttpErrorResponse({ status: 0 }))).toBe('unreachable');
  });

  it('should call any other status a server error', () => {
    expect(lookupFailure(new HttpErrorResponse({ status: 500 }))).toBe('server-error');
  });
});
