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

  /**
   * Real typings for the class ViewedEcosystemService actually calls — unlike
   * CitizenBlockchain above (left `any`, wide blast radius to type properly).
   * `tx` parameters are Transaction *instances* (TransactionMaker.make()
   * output), not raw TxWire objects.
   */
  export class EcosystemBlockchain {
    constructor(blocks?: unknown[])
    readonly blocks: unknown[]
    readonly lastblock: any
    readonly invests: unknown[]
    getMyPublicKey(): string | null

    makeBirthBlock(privateKey: string | null, adminPk: string, name: string, date?: Date): string
    validateAccount(secretKey: string, date?: Date): unknown
    startBlockchain(name: string, signerSk: string, adminPk: string, secretKey?: string | null, date?: Date): string

    isWaitingValidation(): boolean
    isValidated(): boolean

    getAdmins(): Set<string>
    getActors(): Map<string, number>
    getPayers(): Map<string, number>
    isAdmin(publickey: string): boolean
    isActor(publickey: string): boolean
    isPayer(publickey: string): boolean

    getAffordableInvestAmount(date?: Date): number

    receiveSetAdmin(tx: any): void
    receiveUnsetAdmin(tx: any): void
    receiveSetActor(tx: any): void
    receiveUnsetActor(tx: any): void
    receiveSetPayer(tx: any): void
    receiveUnsetPayer(tx: any): void
    receiveInvests(tx: any): void
    receiveMoney(tx: any): void
    receivePay(tx: any): void
    receivePayerOrder(ecosystemSecretKey: string, tx: any): void
    receiveEarn(tx: any): void

    order(ecosystemSecretKey: string, targetPk: string, invests: number[], date?: Date): any
    distributeSalary(ecosystemSecretKey: string, date?: Date): any[]
    earn(ecosystemSecretKey: string, actorPk: string, moneyIds: number[]): any
    cashPaper(tx: any): void

    isValid(depth?: number, banList?: Map<string, unknown>): boolean
    assertIsValid(depth?: number, banList?: Map<string, unknown>): void
    export(): unknown[]
  }
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
