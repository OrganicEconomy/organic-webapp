import { resolveContactName } from './resolve-contact-name.util';

describe('resolve-contact-name.util', () => {
  describe('resolveContactName', () => {
    it('should return the contact name when the public key is a known contact', () => {
      const contacts: any = [{ pk: 'farid-pk', name: 'Farid', url: '', type: 'citizen' }]

      expect(resolveContactName('farid-pk', contacts)).toBe('Farid');
    });

    it('should return a truncated key when the public key is not a known contact', () => {
      const contacts: any = [{ pk: 'farid-pk', name: 'Farid', url: '', type: 'citizen' }]

      expect(resolveContactName('3f9a2b7c1d0e5f6a8b9c0d1e2f3a4b5c', contacts)).toBe('3f9a2b7c…');
    });

    it('should return a truncated key when there are no contacts at all', () => {
      expect(resolveContactName('3f9a2b7c1d0e5f6a8b9c0d1e2f3a4b5c', [])).toBe('3f9a2b7c…');
    });
  });
});
