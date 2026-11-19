import type { DisplayRow } from './transaction-display.util';
import { ALL_TYPES, matchesSearch, matchesType, withMonthHeadings } from './history-entries.util';

function aRow(fields: Partial<DisplayRow>): DisplayRow {
  return {
    date: '15/01/2026',
    month: 'janvier 2026',
    label: 'Paiement',
    icon: 'bi-arrow-up-right',
    parties: null,
    amounts: { money: 0, invests: 0, experience: 0 },
    engagement: null,
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
    label: 'Création du jour',
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

  it('should ignore the space a phone keyboard adds after a word', () => {
    expect(matchesSearch(rowWithZoe, 'zoé ')).toBeTrue();
  });

  it('should find a row by several words, in any order', () => {
    expect(matchesSearch(rowWithZoe, 'zoe creation')).toBeTrue();
    expect(matchesSearch(rowWithZoe, 'zoe paiement')).toBeFalse();
  });

  it('should find a row by its day or its month, as shown', () => {
    expect(matchesSearch(rowWithZoe, '15/01')).toBeTrue();
    expect(matchesSearch(rowWithZoe, 'janvier')).toBeTrue();
  });

  it('should find a row by a part of the whole key of an unknown party', () => {
    const paymentToAKey = aRow({
      parties: {
        source: { label: 'Moi', fullKey: null },
        target: { label: '...cdcdcdcd', fullKey: '03abcdcdcdcd' },
      },
    });

    expect(matchesSearch(paymentToAKey, '03ab')).toBeTrue();
  });

  it('should leave out a row that has none of the words searched', () => {
    expect(matchesSearch(rowWithZoe, 'bob')).toBeFalse();
  });

  it('should find a row by one of its amounts, with or without the sign shown', () => {
    const paymentOfSeven = aRow({ amounts: { money: -7, invests: 0, experience: 0 } });

    expect(matchesSearch(paymentOfSeven, '7')).toBeTrue();
    expect(matchesSearch(paymentOfSeven, '−7')).toBeTrue();
    expect(matchesSearch(paymentOfSeven, '-7')).toBeTrue();
  });

  it('should match a number with a whole amount only, not inside a longer amount or a key', () => {
    const paymentOfSeventeenToAKey = aRow({
      amounts: { money: -17, invests: 0, experience: 0 },
      parties: {
        source: { label: 'Moi', fullKey: null },
        target: { label: '...7a7a7a7a', fullKey: '037a7a7a7a' },
      },
    });

    expect(matchesSearch(paymentOfSeventeenToAKey, '7')).toBeFalse();
  });

  it('should find no row by zero, as an amount of zero is never shown', () => {
    const paymentOfSeven = aRow({ amounts: { money: -7, invests: 0, experience: 0 } });

    expect(matchesSearch(paymentOfSeven, '0')).toBeFalse();
  });
});

describe('matchesType', () => {
  it('should keep every row when no type is chosen', () => {
    expect(matchesType(aRow({ label: 'Paiement' }), ALL_TYPES)).toBeTrue();
  });

  it('should keep only a row of the chosen type', () => {
    expect(matchesType(aRow({ label: 'Paiement' }), 'Paiement')).toBeTrue();
    expect(matchesType(aRow({ label: 'Paiement' }), 'Création du jour')).toBeFalse();
  });
});
