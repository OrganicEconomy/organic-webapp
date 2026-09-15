import { extractServerErrorMessage } from './server-error.util';

describe('server-error.util', () => {
  describe('extractServerErrorMessage', () => {
    it('should return the server\'s error message when present', () => {
      const err = { error: { error: 'Cannot remove actor who is still payer.' } };

      expect(extractServerErrorMessage(err)).toBe('Cannot remove actor who is still payer.');
    });

    it('should return null when there is no error body (e.g. a network error)', () => {
      const err = { status: 0, error: new ProgressEvent('network error') };

      expect(extractServerErrorMessage(err)).toBeNull();
    });

    it('should return null when the error body has no "error" field', () => {
      const err = { error: {} };

      expect(extractServerErrorMessage(err)).toBeNull();
    });

    it('should return null for a null/undefined input', () => {
      expect(extractServerErrorMessage(null)).toBeNull();
      expect(extractServerErrorMessage(undefined)).toBeNull();
    });
  });
});
