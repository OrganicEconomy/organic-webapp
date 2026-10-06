import { requestedAgo } from './requested-ago.util';

describe('requestedAgo', () => {
  const hoursAgo = (n: number) => new Date(Date.now() - n * 3600000).toISOString();
  const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 3600000).toISOString();

  it('should say "moins d\'une heure" for a request less than an hour old', () => {
    expect(requestedAgo(hoursAgo(0.5))).toBe("il y a moins d'une heure");
  });

  it('should say the exact number of hours for a request less than a day old', () => {
    expect(requestedAgo(hoursAgo(5))).toBe('il y a 5h');
  });

  it('should say "hier" for a request exactly one day old', () => {
    expect(requestedAgo(daysAgo(1))).toBe('hier');
  });

  it('should say the exact number of days for a request several days old', () => {
    expect(requestedAgo(daysAgo(4))).toBe('il y a 4 jours');
  });
});
