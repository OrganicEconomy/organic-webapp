import { getContactName, toDisplayRow } from './transaction-display.util';

describe('getContactName', () => {
  it('should return "Moi" when the key is the account\'s own public key', () => {
    expect(getContactName('my-pk', 'my-pk', [])).toBe('Moi');
  });

  it('should return the contact\'s name when the key matches a known contact', () => {
    const contacts = [{ pk: 'alice-pk', name: 'Alice' }];
    expect(getContactName('alice-pk', 'my-pk', contacts)).toBe('Alice');
  });

  it('should return a truncated key when the key matches no known contact', () => {
    expect(getContactName('some-unknown-public-key', 'my-pk', [])).toBe('...blic-key');
  });

  it('should return "-" for an empty/falsy key', () => {
    expect(getContactName('', 'my-pk', [])).toBe('-');
  });
});

describe('toDisplayRow', () => {
  it('should read the source contact from tx.signer, not the nonexistent tx.source', () => {
    const tx = { date: new Date(2026, 0, 15), type: 3, signer: 'alice-pk', target: 'my-pk', money: [1, 2, 3] };
    const row = toDisplayRow(tx, 'my-pk', [{ pk: 'alice-pk', name: 'Alice' }]);
    expect(row.source).toBe('Alice');
  });

  it('should map the numeric type to its French label and the amount to money.length', () => {
    const tx = { date: new Date(2026, 0, 15), type: 3, signer: 'alice-pk', target: 'my-pk', money: [1, 2, 3] };
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.type).toBe('Paiement');
    expect(row.amount).toBe(3);
  });
});
