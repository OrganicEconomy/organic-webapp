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
    expect(row.parties?.source.label).toBe('Alice');
  });

  it('should map the numeric type to its French label', () => {
    const tx = { date: new Date(2026, 0, 15), type: 3, signer: 'alice-pk', target: 'my-pk', money: [1, 2, 3] };
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.type).toBe('Paiement');
  });

  it('should count the daily creation as money and invests gained', () => {
    const tx = { date: new Date(2026, 0, 15), type: 2, signer: 'my-pk', target: '', money: [1, 2], invests: [3] };
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.amounts).toEqual({ money: 2, invests: 1, experience: 0 });
  });

  it('should map PAYERORDER (12) to a French label instead of showing the raw number', () => {
    const tx = { date: new Date(2026, 0, 15), type: 12, signer: 'alice-pk', target: 'my-pk', money: [] };
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.type).toBe('Ordre de paiement');
  });

  it('should map EARN (13) to a French label instead of showing the raw number', () => {
    const tx = { date: new Date(2026, 0, 15), type: 13, signer: 'alice-pk', target: 'my-pk', money: [1] };
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.type).toBe('Gain');
  });

  it('should abbreviate a key that matches no contact, keeping the whole key to show on demand', () => {
    const tx = { date: new Date(2026, 0, 15), type: 3, signer: 'some-unknown-public-key', target: 'my-pk', money: [1] };
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.parties?.source).toEqual({ label: '...blic-key', fullKey: 'some-unknown-public-key' });
  });

  it('should name a contact or oneself without any key to show', () => {
    const tx = { date: new Date(2026, 0, 15), type: 3, signer: 'alice-pk', target: 'my-pk', money: [1] };
    const row = toDisplayRow(tx, 'my-pk', [{ pk: 'alice-pk', name: 'Alice' }]);
    expect(row.parties?.source).toEqual({ label: 'Alice', fullKey: null });
    expect(row.parties?.target).toEqual({ label: 'Moi', fullKey: null });
  });

  it('should show the account opening without sender nor receiver', () => {
    const tx = { date: new Date(2026, 0, 15), type: 1, signer: 'my-pk', target: '', money: [] };
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.type).toBe('Ouverture du compte');
    expect(row.parties).toBeNull();
  });

  it('should show the daily creation without sender nor receiver', () => {
    const tx = { date: new Date(2026, 0, 15), type: 2, signer: 'my-pk', target: '', money: [1, 2] };
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.type).toBe('Création du jour');
    expect(row.parties).toBeNull();
  });

  it('should label a payment to oneself as a cashing', () => {
    const tx = { date: new Date(2026, 0, 15), type: 3, signer: 'my-pk', target: 'my-pk', money: [1, 2] };
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.type).toBe('Encaissement');
  });
});
