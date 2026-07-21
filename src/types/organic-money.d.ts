/**
 * Minimal typings for the untyped organic-money library — only what the
 * webapp actually imports. Mirrors organic-webserver/types/organic-money.d.ts.
 */
declare module 'organic-money/src/index.js' {
  export function publicFromPrivate(secretkey: string): string
  export function dateToInt(date: Date): number
  export function intToDate(intdate: number): Date
  export const BlockMaker: any
  export const TransactionMaker: any
  export const Blockchain: any
  export const CitizenBlockchain: any
  export const EcosystemBlockchain: any
}

declare module 'organic-money/src/crypto.js' {
  export function randomPrivateKey(): string
  export function dateToInt(date: Date): number
  export function intToDate(intdate: number): Date

  /** AES-encrypted payload — each field is raw bytes, never assume a string shape. */
  export interface AesEncrypted {
    msg: Uint8Array
    iv: Uint8Array
    salt: Uint8Array
    verifier: Uint8Array
  }

  export function aesEncrypt(msg: Uint8Array, pwd: string): Promise<AesEncrypted>
  /** Throws Error('Invalid password') when pwd doesn't match — never compare it yourself. */
  export function aesDecrypt(encrypted: AesEncrypted, pwd: string): Promise<Uint8Array>

  /** hash is raw bytes (e.g. block.hash() or hashTimestampAuth's result), sk is hex. */
  export function signHash(hash: Uint8Array, secretkey: string): string
  export function verifySignature(hash: Uint8Array, signature: string, publickey: string): boolean
  export function hashTimestampAuth(publickey: string, timestamp: string | number): Uint8Array
}
