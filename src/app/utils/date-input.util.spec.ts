import { formatDateInput, parseDateInput } from './date-input.util';

describe('formatDateInput', () => {
  it('should insert a slash after the day once 2 digits are typed', () => {
    expect(formatDateInput('15')).toBe('15');
    expect(formatDateInput('154')).toBe('15/4');
  });

  it('should insert a slash after the month once 4 digits are typed', () => {
    expect(formatDateInput('1504')).toBe('15/04');
    expect(formatDateInput('15041')).toBe('15/04/1');
  });

  it('should format a complete day/month/year input', () => {
    expect(formatDateInput('15041990')).toBe('15/04/1990');
  });

  it('should strip any non-digit character from the raw input', () => {
    expect(formatDateInput('15/04/1990')).toBe('15/04/1990');
    expect(formatDateInput('ab15cd04ef1990')).toBe('15/04/1990');
  });

  it('should truncate anything past 8 digits (day+month+year)', () => {
    expect(formatDateInput('150419901234')).toBe('15/04/1990');
  });
});

describe('parseDateInput', () => {
  it('should parse a complete, valid date into a Date at UTC midnight', () => {
    const date = parseDateInput('15/04/1990');

    expect(date).not.toBeNull();
    expect(date!.getUTCFullYear()).toBe(1990);
    expect(date!.getUTCMonth()).toBe(3);
    expect(date!.getUTCDate()).toBe(15);
  });

  it('should return null for an incomplete date', () => {
    expect(parseDateInput('15/04')).toBeNull();
    expect(parseDateInput('')).toBeNull();
  });

  it('should return null for a day that does not exist in that month (e.g. 31 April)', () => {
    expect(parseDateInput('31/04/2020')).toBeNull();
  });

  it('should return null for 29 February on a non-leap year', () => {
    expect(parseDateInput('29/02/2021')).toBeNull();
  });

  it('should accept 29 February on a leap year', () => {
    expect(parseDateInput('29/02/2020')).not.toBeNull();
  });
});
