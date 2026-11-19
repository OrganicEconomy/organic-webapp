import type { DisplayRow } from './transaction-display.util';
import { hasType, matchesSearch, withMonthHeadings } from './history-filter.util';

function aRow(fields: Partial<DisplayRow>): DisplayRow {
  return {
    date: '15/01/2026',
    month: 'janvier 2026',
    type: 'Paiement',
    icon: 'bi-arrow-up-right',
    parties: null,
    amounts: { money: 0, invests: 0, experience: 0 },
    ...fields,
  };
}

describe('withMonthHeadings', () => {
  it('should put the name of the month before its first row only', () => {
    const january = [aRow({ date: '20/01/2026' }), aRow({ date: '10/01/2026' })];
    const december = aRow({ date: '31/12/2025', month: 'décembre 2025' });

    expect(withMonthHeadings([...january, december])).toEqual([
      { heading: 'janvier 2026' },
      ...january,
      { heading: 'décembre 2025' },
      december,
    ]);
  });
});

describe('matchesSearch', () => {
  const rowWithZoe = aRow({
    type: 'Création du jour',
    parties: {
      source: { label: 'Moi', fullKey: null },
      target: { label: 'Zoé', fullKey: null },
    },
  });

  it('should find a row by its type, whatever the accents and the case', () => {
    expect(matchesSearch(rowWithZoe, 'CREATION')).toBeTrue();
  });

  it('should find a row by the name of its sender or receiver, whatever the accents', () => {
    expect(matchesSearch(rowWithZoe, 'zoe')).toBeTrue();
  });

  it('should leave out a row that has none of the words searched', () => {
    expect(matchesSearch(rowWithZoe, 'bob')).toBeFalse();
  });

  it('should find a row by one of its amounts', () => {
    const paymentOfSeven = aRow({ amounts: { money: -7, invests: 0, experience: 0 } });

    expect(matchesSearch(paymentOfSeven, '7')).toBeTrue();
  });
});

describe('hasType', () => {
  it('should keep every row when no type is chosen', () => {
    expect(hasType(aRow({ type: 'Paiement' }), null)).toBeTrue();
  });

  it('should keep only a row of the chosen type', () => {
    expect(hasType(aRow({ type: 'Paiement' }), 'Paiement')).toBeTrue();
    expect(hasType(aRow({ type: 'Paiement' }), 'Création du jour')).toBeFalse();
  });
});
