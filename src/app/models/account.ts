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
  pendingOfflineTx: TxWire[]
  sentOfflineTx: TxWire[]
  status: 'active'
  devicetoken: string
}

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
  }
}
