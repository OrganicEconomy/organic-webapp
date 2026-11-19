import { displayNameOf, toDisplayRow } from './transaction-display.util';

describe('displayNameOf', () => {
  it('should return "Moi" when the key is the account\'s own public key', () => {
    expect(displayNameOf('my-pk', 'my-pk', [])).toBe('Moi');
  });

  it('should return the contact\'s name when the key matches a known contact', () => {
    const contacts = [{ pk: 'alice-pk', name: 'Alice' }];
    expect(displayNameOf('alice-pk', 'my-pk', contacts)).toBe('Alice');
  });

  it('should return a truncated key when the key matches no known contact', () => {
    expect(displayNameOf('some-unknown-public-key', 'my-pk', [])).toBe('...blic-key');
  });

  it('should return "-" for an empty/falsy key', () => {
    expect(displayNameOf('', 'my-pk', [])).toBe('-');
  });
});

describe('toDisplayRow', () => {
  it('should map the numeric type to its French label and the amount to money.length', () => {
    const tx = { date: new Date(2026, 0, 15), type: 3, signer: 'alice-pk', target: 'my-pk', money: [1, 2, 3] };
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.type).toBe('Paiement');
    expect(row.amount).toBe(3);
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

  it('should abbreviate an unknown receiver the same way', () => {
    const tx = { date: new Date(2026, 0, 15), type: 3, signer: 'my-pk', target: 'some-unknown-public-key', money: [1] };
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.parties?.target).toEqual({ label: '...blic-key', fullKey: 'some-unknown-public-key' });
  });

  it('should name a known contact, read from tx.signer, without any key to show', () => {
    const tx = { date: new Date(2026, 0, 15), type: 3, signer: 'alice-pk', target: 'my-pk', money: [1] };
    const row = toDisplayRow(tx, 'my-pk', [{ pk: 'alice-pk', name: 'Alice' }]);
    expect(row.parties?.source).toEqual({ label: 'Alice', fullKey: null });
  });

  it('should name oneself "Moi" without any key to show', () => {
    const tx = { date: new Date(2026, 0, 15), type: 3, signer: 'alice-pk', target: 'my-pk', money: [1] };
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.parties?.target).toEqual({ label: 'Moi', fullKey: null });
  });

  it('should show a missing key as "-", with no key to show', () => {
    const tx = { date: new Date(2026, 0, 15), type: 4, signer: 'my-pk', target: '', money: [] };
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.parties?.target).toEqual({ label: '-', fullKey: null });
  });

  it('should show the account opening with neither sender nor receiver', () => {
    const tx = { date: new Date(2026, 0, 15), type: 1, signer: 'my-pk', target: '', money: [] };
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.type).toBe('Ouverture du compte');
    expect(row.parties).toBeNull();
  });

  it('should show the daily creation with neither sender nor receiver', () => {
    const tx = { date: new Date(2026, 0, 15), type: 2, signer: 'my-pk', target: '', money: [1, 2] };
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.type).toBe('Création du jour');
    expect(row.parties).toBeNull();
  });

  it('should show a payment to oneself with neither sender nor receiver', () => {
    const tx = { date: new Date(2026, 0, 15), type: 3, signer: 'my-pk', target: 'my-pk', money: [1] };
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.parties).toBeNull();
  });

  it('should send a printed bill to its bearer, not to the core it is checked by', () => {
    const tx = { date: new Date(2026, 0, 15), type: 5, signer: 'my-pk', target: 'core-pk', money: [1] };
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.parties?.source.label).toBe('Moi');
    expect(row.parties?.target).toEqual({ label: 'Porteur du billet', fullKey: null });
  });

  it('should show a cashed bill as received from its issuer', () => {
    const tx = { date: new Date(2026, 0, 15), type: 5, signer: 'alice-pk', target: 'core-pk', money: [1] };
    const row = toDisplayRow(tx, 'my-pk', [{ pk: 'alice-pk', name: 'Alice' }]);
    expect(row.parties?.source.label).toBe('Alice');
    expect(row.parties?.target.label).toBe('Moi');
  });

  it('should label a payment to oneself as a cashing', () => {
    const tx = { date: new Date(2026, 0, 15), type: 3, signer: 'my-pk', target: 'my-pk', money: [1, 2] };
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.type).toBe('Encaissement');
  });
});
