import { isWellFormedPublicKey } from './public-key.util';

describe('isWellFormedPublicKey', () => {
  it('should accept a compressed public key', () => {
    expect(isWellFormedPublicKey('02' + 'a1'.repeat(32))).toBeTrue();
  });

  it('should refuse a key that is too short', () => {
    expect(isWellFormedPublicKey('abcdef123456')).toBeFalse();
  });

  it('should refuse a key of the right length that is not hexadecimal', () => {
    expect(isWellFormedPublicKey('02' + 'zz'.repeat(32))).toBeFalse();
  });

  it('should refuse a key that does not start with 02 or 03', () => {
    expect(isWellFormedPublicKey('04' + 'a1'.repeat(32))).toBeFalse();
  });

  it('should refuse an uppercase key, which would match no account', () => {
    expect(isWellFormedPublicKey('02' + 'A1'.repeat(32))).toBeFalse();
  });
});
