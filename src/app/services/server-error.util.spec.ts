import { extractServerErrorMessage, isDuplicateTransactionError, duplicateTransactionMessage } from './server-error.util';
import { InvalidTransactionError } from 'organic-money/src/errors.js';

describe('server-error.util', () => {
  describe('isDuplicateTransactionError', () => {
    it('should return true for an InvalidTransactionError about a duplicate transaction', () => {
      const err = new InvalidTransactionError('Transaction duplicate abc123');

      expect(isDuplicateTransactionError(err)).toBeTrue();
    });

    it('should return false for an InvalidTransactionError with a different message', () => {
      const err = new InvalidTransactionError('Unsufficient funds.');

      expect(isDuplicateTransactionError(err)).toBeFalse();
    });

    it('should return false for a non-InvalidTransactionError error', () => {
      const err = new Error('Transaction duplicate abc123');

      expect(isDuplicateTransactionError(err)).toBeFalse();
    });

    it('should return false for a null/undefined input', () => {
      expect(isDuplicateTransactionError(null)).toBeFalse();
      expect(isDuplicateTransactionError(undefined)).toBeFalse();
    });
  });

  describe('duplicateTransactionMessage', () => {
    it('should return a clear message for a duplicate-transaction error', () => {
      const err = new InvalidTransactionError('Transaction duplicate abc123');

      expect(duplicateTransactionMessage(err)).toBe("Cette action a déjà été tentée aujourd'hui — réessayez demain.");
    });

    it('should return null for an InvalidTransactionError with a different message', () => {
      const err = new InvalidTransactionError('Unsufficient funds.');

      expect(duplicateTransactionMessage(err)).toBeNull();
    });

    it('should return null for a non-InvalidTransactionError error', () => {
      const err = new Error('Transaction duplicate abc123');

      expect(duplicateTransactionMessage(err)).toBeNull();
    });

    it('should return null for a null/undefined input', () => {
      expect(duplicateTransactionMessage(null)).toBeNull();
      expect(duplicateTransactionMessage(undefined)).toBeNull();
    });
  });

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
