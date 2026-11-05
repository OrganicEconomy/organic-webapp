import { contactLink } from './contact-link.util';

describe('contactLink', () => {
  it('should point to the contact form with the card in the query', () => {
    const link = contactLink('https://app.economie-organique.fr/', {
      pk: '02abc',
      url: 'https://test2.economie-organique.fr',
      name: 'Chloé Bernard',
    });

    expect(link).toBe(
      'https://app.economie-organique.fr/addcontact?pk=02abc&server=https%3A%2F%2Ftest2.economie-organique.fr&name=Chlo%C3%A9+Bernard',
    );
  });
});
