import { displayNameOf, toDisplayRow, withSign } from './transaction-display.util';

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

function aTransaction(fields: object) {
  return { date: new Date(2026, 0, 15), signer: 'my-pk', target: '', money: [], invests: [], ...fields };
}

describe('toDisplayRow', () => {
  it('should map the numeric type to its French label', () => {
    const tx = aTransaction({ type: 3, signer: 'alice-pk', target: 'my-pk', money: [1, 2, 3] });
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.label).toBe('Paiement');
  });

  it('should count the daily creation as money and invests gained', () => {
    const tx = aTransaction({ type: 2, money: [1, 2], invests: [3] });
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.amounts).toEqual({ money: 2, invests: 1, experience: 0 });
  });

  it('should count a payment to someone else as money spent', () => {
    const tx = aTransaction({ type: 3, target: 'alice-pk', money: [1, 2] });
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.amounts).toEqual({ money: -2, invests: 0, experience: 0 });
  });

  it('should count a payment received as experience gained, not as money', () => {
    const tx = aTransaction({ type: 3, signer: 'alice-pk', target: 'my-pk', money: [1, 2, 3] });
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.amounts).toEqual({ money: 0, invests: 0, experience: 3 });
  });

  it('should count an engagement as the invests it engages', () => {
    const tx = aTransaction({ type: 4, target: 'eco-pk', invests: [1, 2, 3, 4] });
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.amounts).toEqual({ money: 0, invests: -4, experience: 0 });
  });

  it('should count no invests of mine for a payer order, which spends those of the ecosystem', () => {
    const tx = aTransaction({ type: 12, target: 'bob-pk', invests: [1, 2] });
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.amounts).toEqual({ money: 0, invests: 0, experience: 0 });
  });

  it('should count printed bills as money spent', () => {
    const tx = aTransaction({ type: 5, target: 'core-pk', money: [1, 2] });
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.amounts).toEqual({ money: -2, invests: 0, experience: 0 });
  });

  it('should count a cashed bill as experience gained', () => {
    const tx = aTransaction({ type: 5, signer: 'alice-pk', target: 'core-pk', money: [1, 2, 3] });
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.amounts).toEqual({ money: 0, invests: 0, experience: 3 });
  });

  it('should count an earning from an ecosystem as experience gained', () => {
    const tx = aTransaction({ type: 13, signer: 'eco-pk', target: 'my-pk', money: [1, 2] });
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.amounts).toEqual({ money: 0, invests: 0, experience: 2 });
  });

  it('should count a payment to oneself as money spent and experience gained', () => {
    const tx = aTransaction({ type: 3, target: 'my-pk', money: [1, 2] });
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.amounts).toEqual({ money: -2, invests: 0, experience: 2 });
  });

  it('should count no amount for a role given in an ecosystem', () => {
    const tx = aTransaction({ type: 7, target: 'bob-pk' });
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.amounts).toEqual({ money: 0, invests: 0, experience: 0 });
  });

  it('should tell a printed bill from a cashed one', () => {
    const printed = aTransaction({ type: 5, target: 'core-pk', money: [1] });
    const cashed = aTransaction({ type: 5, signer: 'alice-pk', target: 'core-pk', money: [1] });
    expect(toDisplayRow(printed, 'my-pk', []).label).toBe('Billet imprimé');
    expect(toDisplayRow(cashed, 'my-pk', []).label).toBe('Billet encaissé');
  });

  it('should map PAYERORDER (12) to a French label instead of showing the raw number', () => {
    const tx = aTransaction({ type: 12, signer: 'alice-pk', target: 'my-pk' });
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.label).toBe('Ordre de paiement');
  });

  it('should map EARN (13) to a French label instead of showing the raw number', () => {
    const tx = aTransaction({ type: 13, signer: 'alice-pk', target: 'my-pk', money: [1] });
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.label).toBe('Gain');
  });

  it('should abbreviate a key that matches no contact, keeping the whole key to show on demand', () => {
    const tx = aTransaction({ type: 3, signer: 'some-unknown-public-key', target: 'my-pk', money: [1] });
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.parties?.source).toEqual({ label: '...blic-key', fullKey: 'some-unknown-public-key' });
  });

  it('should abbreviate an unknown receiver the same way', () => {
    const tx = aTransaction({ type: 3, target: 'some-unknown-public-key', money: [1] });
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.parties?.target).toEqual({ label: '...blic-key', fullKey: 'some-unknown-public-key' });
  });

  it('should name a known contact, read from tx.signer, without any key to show', () => {
    const tx = aTransaction({ type: 3, signer: 'alice-pk', target: 'my-pk', money: [1] });
    const row = toDisplayRow(tx, 'my-pk', [{ pk: 'alice-pk', name: 'Alice' }]);
    expect(row.parties?.source).toEqual({ label: 'Alice', fullKey: null });
  });

  it('should name oneself "Moi" without any key to show', () => {
    const tx = aTransaction({ type: 3, signer: 'alice-pk', target: 'my-pk', money: [1] });
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.parties?.target).toEqual({ label: 'Moi', fullKey: null });
  });

  it('should show a missing key as "-", with no key to show', () => {
    const tx = aTransaction({ type: 4 });
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.parties?.target).toEqual({ label: '-', fullKey: null });
  });

  it('should show the account opening with neither sender nor receiver', () => {
    const tx = aTransaction({ type: 1 });
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.label).toBe('Ouverture du compte');
    expect(row.parties).toBeNull();
  });

  it('should show the daily creation with neither sender nor receiver', () => {
    const tx = aTransaction({ type: 2, money: [1, 2], invests: [3] });
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.label).toBe('Création du jour');
    expect(row.parties).toBeNull();
  });

  it('should show a payment to oneself with neither sender nor receiver', () => {
    const tx = aTransaction({ type: 3, target: 'my-pk', money: [1] });
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.parties).toBeNull();
  });

  it('should send a printed bill to its bearer, not to the core it is checked by', () => {
    const tx = aTransaction({ type: 5, target: 'core-pk', money: [1] });
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.parties?.source.label).toBe('Moi');
    expect(row.parties?.target).toEqual({ label: 'Porteur du billet', fullKey: null });
  });

  it('should show a cashed bill as received from its issuer', () => {
    const tx = aTransaction({ type: 5, signer: 'alice-pk', target: 'core-pk', money: [1] });
    const row = toDisplayRow(tx, 'my-pk', [{ pk: 'alice-pk', name: 'Alice' }]);
    expect(row.parties?.source.label).toBe('Alice');
    expect(row.parties?.target.label).toBe('Moi');
  });

  it('should label a payment to oneself as a cashing', () => {
    const tx = aTransaction({ type: 3, target: 'my-pk', money: [1, 2] });
    const row = toDisplayRow(tx, 'my-pk', []);
    expect(row.label).toBe('Encaissement');
  });

  [
    { kind: 'the account opening', type: 1, signer: 'my-pk', target: 'Camille', icon: 'bi-person-plus' },
    { kind: 'the daily creation', type: 2, signer: 'my-pk', target: '', icon: 'bi-stars' },
    { kind: 'a payment sent', type: 3, signer: 'my-pk', target: 'alice-pk', icon: 'bi-arrow-up-right' },
    { kind: 'a payment received', type: 3, signer: 'alice-pk', target: 'my-pk', icon: 'bi-arrow-down-left' },
    { kind: 'a payment to oneself', type: 3, signer: 'my-pk', target: 'my-pk', icon: 'bi-arrow-repeat' },
    { kind: 'an engagement', type: 4, signer: 'my-pk', target: 'eco-pk', icon: 'bi-piggy-bank' },
    { kind: 'a printed bill', type: 5, signer: 'my-pk', target: 'core-pk', icon: 'bi-printer' },
    { kind: 'a cashed bill', type: 5, signer: 'alice-pk', target: 'core-pk', icon: 'bi-qr-code-scan' },
    { kind: 'an admin named', type: 6, signer: 'my-pk', target: 'bob-pk', icon: 'bi-person-badge' },
    { kind: 'a role given', type: 7, signer: 'my-pk', target: 'bob-pk', icon: 'bi-person-badge' },
    { kind: 'a payer named', type: 8, signer: 'my-pk', target: 'bob-pk', icon: 'bi-person-badge' },
    { kind: 'an admin removed', type: 9, signer: 'my-pk', target: 'bob-pk', icon: 'bi-person-badge' },
    { kind: 'an actor removed', type: 10, signer: 'my-pk', target: 'bob-pk', icon: 'bi-person-badge' },
    { kind: 'a payer removed', type: 11, signer: 'my-pk', target: 'bob-pk', icon: 'bi-person-badge' },
    { kind: 'a payer order', type: 12, signer: 'my-pk', target: 'bob-pk', icon: 'bi-receipt' },
    { kind: 'an earning', type: 13, signer: 'eco-pk', target: 'my-pk', icon: 'bi-briefcase' },
  ].forEach(({ kind, type, signer, target, icon }) => {
    it(`should show ${kind} with its own icon`, () => {
      const tx = aTransaction({ type, signer, target });
      expect(toDisplayRow(tx, 'my-pk', []).icon).toBe(icon);
    });
  });

  it('should show a type it does not know with a generic icon', () => {
    const tx = aTransaction({ type: 99 });
    expect(toDisplayRow(tx, 'my-pk', []).icon).toBe('bi-question-circle');
  });
});

describe('withSign', () => {
  it('should write a gain with a plus sign', () => {
    expect(withSign(3)).toBe('+3');
  });

  it('should write a spending with a minus sign', () => {
    expect(withSign(-3)).toBe('−3');
  });

  it('should write zero without any sign', () => {
    expect(withSign(0)).toBe('0');
  });
});
