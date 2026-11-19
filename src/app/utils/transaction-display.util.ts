import { TxType } from 'organic-protocol'

function abbreviatedKey(pk: string): string {
  return "..." + pk.slice(-8)
}

export function displayNameOf(pk: string, myPublicKey: string, contacts: any[]): string {
  if (!pk) return "-"
  if (pk === myPublicKey) return "Moi"
  const contact: any = contacts.find((contact: any) => contact.pk === pk)
  return contact ? contact.name : abbreviatedKey(pk)
}

const TX_TYPE_LABELS: Record<number, string> = {
  [TxType.INIT]: "Ouverture du compte",
  [TxType.CREATE]: "Création du jour",
  [TxType.PAY]: "Paiement",
  [TxType.ENGAGE]: "Engagement",
  [TxType.PAPER]: "Billet",
  [TxType.SETADMIN]: "Assignation Admin",
  [TxType.SETACTOR]: "Assignation Acteur",
  [TxType.SETPAYER]: "Assignation Payeur",
  [TxType.UNSETADMIN]: "Suppression Admin",
  [TxType.UNSETACTOR]: "Suppression Acteur",
  [TxType.UNSETPAYER]: "Suppression Payeur",
  [TxType.PAYERORDER]: "Ordre de paiement",
  [TxType.EARN]: "Gain",
}

function isCashing(tx: any): boolean {
  return tx.type === TxType.PAY && tx.signer === tx.target
}

function typeLabel(tx: any): string {
  return isCashing(tx) ? "Encaissement" : TX_TYPE_LABELS[tx.type] ?? String(tx.type)
}

export interface Party {
  label: string
  fullKey: string | null
}

export interface Parties {
  source: Party
  target: Party
}

export interface DisplayRow {
  date: string
  type: string
  parties: Parties | null
  amount: number
}

const PAPER_BEARER: Party = { label: "Porteur du billet", fullKey: null }

function isUnknownKey(pk: string, myPublicKey: string, contacts: any[]): boolean {
  return !!pk && pk !== myPublicKey && !contacts.some((contact: any) => contact.pk === pk)
}

function partyOf(pk: string, myPublicKey: string, contacts: any[]): Party {
  if (isUnknownKey(pk, myPublicKey, contacts)) {
    return { label: abbreviatedKey(pk), fullKey: pk }
  }
  return { label: displayNameOf(pk, myPublicKey, contacts), fullKey: null }
}

function receiverOf(tx: any, myPublicKey: string, contacts: any[]): Party {
  if (tx.type !== TxType.PAPER) {
    return partyOf(tx.target, myPublicKey, contacts)
  }
  return tx.signer === myPublicKey ? PAPER_BEARER : partyOf(myPublicKey, myPublicKey, contacts)
}

function partiesOf(tx: any, myPublicKey: string, contacts: any[]): Parties {
  return {
    source: partyOf(tx.signer, myPublicKey, contacts),
    target: receiverOf(tx, myPublicKey, contacts),
  }
}

const TYPES_WITHOUT_PARTIES = [TxType.INIT, TxType.CREATE]

function hasParties(tx: any): boolean {
  return !TYPES_WITHOUT_PARTIES.includes(tx.type) && !isCashing(tx)
}

export function toDisplayRow(tx: any, myPublicKey: string, contacts: any[]): DisplayRow {
  return {
    date: tx.date.toLocaleDateString("fr-FR"),
    type: typeLabel(tx),
    parties: hasParties(tx) ? partiesOf(tx, myPublicKey, contacts) : null,
    amount: tx.money.length,
  }
}
