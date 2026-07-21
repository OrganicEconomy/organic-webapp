import { aesDecrypt, aesEncrypt, type AesEncrypted } from 'organic-money/src/crypto.js'

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

interface SerializedBlob {
  msg: string
  iv: string
  salt: string
  verifier: string
}

/**
 * Encrypts a hex secret key for storage/transport. aesEncrypt (organic-money)
 * works on bytes and returns a structured { msg, iv, salt, verifier } object —
 * this serializes that into the single opaque string the server and the local
 * account record expect.
 */
export async function encryptSecretKey(secretKeyHex: string, password: string): Promise<string> {
  const encrypted = await aesEncrypt(hexToBytes(secretKeyHex), password)
  const blob: SerializedBlob = {
    msg: toHex(encrypted.msg),
    iv: toHex(encrypted.iv),
    salt: toHex(encrypted.salt),
    verifier: toHex(encrypted.verifier),
  }
  return JSON.stringify(blob)
}

/**
 * Reverses encryptSecretKey. Throws Error('Invalid password') on a wrong
 * password (from aesDecrypt) — that is the only signal of failure; the
 * password is never compared directly anywhere.
 */
export async function decryptSecretKey(blob: string, password: string): Promise<string> {
  const parsed: SerializedBlob = JSON.parse(blob)
  const encrypted: AesEncrypted = {
    msg: hexToBytes(parsed.msg),
    iv: hexToBytes(parsed.iv),
    salt: hexToBytes(parsed.salt),
    verifier: hexToBytes(parsed.verifier),
  }
  const decrypted = await aesDecrypt(encrypted, password)
  return toHex(decrypted)
}
