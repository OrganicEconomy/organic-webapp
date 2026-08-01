import type { BlockWire, TxWire } from 'organic-protocol'

export type ContactType = 'citizen' | 'ecosystem'

export interface Contact {
  name: string
  pk: string
  url: string
  type: ContactType
}

export type BackupPolicy = 'every-tx' | 'manual' | 'payments-only'

/**
 * An offline payment received camera-to-screen, awaiting deferred server-side
 * verification (POST tx/verify). The payer's own server url must travel with
 * the tx — it can't be assumed to be OUR server, and there's no other way to
 * know where to ask once we're past the scan screen (possibly much later).
 */
export interface PendingOfflineTx {
  tx: TxWire
  url: string
}

/**
 * One record per account on the device, keyed by publickey (Phase-1.md §5.1).
 * secretkey is always the AES-encrypted, serialized blob (see secret-key-crypto.util.ts) —
 * the plaintext secret key and the login password never get stored here.
 */
export interface Account {
  publickey: string
  name: string
  serverUrl: string
  blocks: BlockWire[]
  secretkey: string
  contacts: Contact[]
  backupPolicy: BackupPolicy
  lastBackupAt: string | null
  isuptodate: boolean
  pendingOfflineTx: PendingOfflineTx[]
  sentOfflineTx: TxWire[]
  status: 'active'
  devicetoken: string
  /**
   * Signature of the most recent block this device knows the server has
   * confirmed (null until the first successful save). Lets a save catch up
   * on any block closed locally in between, instead of only ever sending the
   * current one and silently leaving older closed blocks behind.
   */
  lastSavedBlockSignature: string | null
}

/** The in-memory shape components work with: a stored Account plus its live blockchain. */
export type LoadedAccount = Account & { blockchain: any }

export function makeDefaultAccount(publickey: string): Account {
  return {
    publickey,
    name: '',
    serverUrl: '',
    blocks: [],
    secretkey: '',
    contacts: [],
    backupPolicy: 'every-tx',
    lastBackupAt: null,
    isuptodate: false,
    pendingOfflineTx: [],
    sentOfflineTx: [],
    status: 'active',
    devicetoken: '',
    lastSavedBlockSignature: null,
  }
}
