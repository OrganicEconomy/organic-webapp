import { comparable } from './comparable-text.util';

describe('comparable', () => {
  it('should drop the accents and the case', () => {
    expect(comparable('Création ÉTÉ')).toBe('creation ete');
  });

  it('should spell out the ligatures, so that "coeur" finds "Cœur"', () => {
    expect(comparable('Cœur Æther')).toBe('coeur aether');
  });
});
