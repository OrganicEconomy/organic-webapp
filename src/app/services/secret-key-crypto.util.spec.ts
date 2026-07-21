import { decryptSecretKey, encryptSecretKey } from './secret-key-crypto.util';

describe('secret-key-crypto.util', () => {
  const secretKeyHex = 'ed945716dddb7af2c9774939e9946f1fee31f5ec0a3c6ec96059f119c396912f'

  it('should round-trip a secret key with the right password', async () => {
    const blob = await encryptSecretKey(secretKeyHex, 'correct horse battery staple')

    const decrypted = await decryptSecretKey(blob, 'correct horse battery staple')

    expect(decrypted).toBe(secretKeyHex)
  });

  it('should reject a wrong password without ever comparing it directly', async () => {
    const blob = await encryptSecretKey(secretKeyHex, 'the-real-password')

    await expectAsync(decryptSecretKey(blob, 'a-wrong-password')).toBeRejectedWithError('Invalid password')
  });

  it('should produce an opaque blob that never contains the plaintext secret key', async () => {
    const blob = await encryptSecretKey(secretKeyHex, 'pw')

    expect(blob).not.toContain(secretKeyHex)
  });

  it('should produce a different blob each time (random salt/iv), even for the same input', async () => {
    const blob1 = await encryptSecretKey(secretKeyHex, 'pw')
    const blob2 = await encryptSecretKey(secretKeyHex, 'pw')

    expect(blob1).not.toBe(blob2)
  });

  it('should return a JSON string safe to store in an Account record or send to the server', async () => {
    const blob = await encryptSecretKey(secretKeyHex, 'pw')

    expect(() => JSON.parse(blob)).not.toThrow()
    expect(typeof blob).toBe('string')
  });
});
