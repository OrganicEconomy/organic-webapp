import { TxType } from 'organic-protocol'

export function getContactName(pk: string, myPublicKey: string, contacts: any[]): string {
  if (!pk) return "-"
  if (pk === myPublicKey) return "Moi"
  const contact: any = contacts.find((c: any) => c.pk === pk)
  return contact ? contact.name : "..." + pk.slice(-8)
}

export const TX_TYPE_LABELS: Record<string, string> = {
  "1": "Ouverture du compte",
  "2": "Création du jour",
  "3": "Paiement",
  "4": "Engagement",
  "5": "Billet",
  "6": "Assignation Admin",
  "7": "Assignation Acteur",
  "8": "Assignation Payeur",
  "9": "Suppression Admin",
  "10": "Suppression Acteur",
  "11": "Suppression Payeur",
  "12": "Ordre de paiement",
  "13": "Gain",
}

function isCashing(tx: any): boolean {
  return String(tx.type) === "3" && tx.signer === tx.target
}

function typeLabel(tx: any): string {
  return isCashing(tx) ? "Encaissement" : TX_TYPE_LABELS[tx.type] ?? tx.type
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

const TYPES_WITHOUT_PARTIES = [TxType.INIT, TxType.CREATE]

function hasParties(tx: any): boolean {
  return !TYPES_WITHOUT_PARTIES.includes(tx.type)
}

function isUnknownKey(pk: string, myPublicKey: string, contacts: any[]): boolean {
  return !!pk && pk !== myPublicKey && !contacts.some((contact: any) => contact.pk === pk)
}

function partyOf(pk: string, myPublicKey: string, contacts: any[]): Party {
  return {
    label: getContactName(pk, myPublicKey, contacts),
    fullKey: isUnknownKey(pk, myPublicKey, contacts) ? pk : null,
  }
}

function partiesOf(tx: any, myPublicKey: string, contacts: any[]): Parties {
  return {
    source: partyOf(tx.signer, myPublicKey, contacts),
    target: partyOf(tx.target, myPublicKey, contacts),
  }
}

export function toDisplayRow(tx: any, myPublicKey: string, contacts: any[]): DisplayRow {
  return {
    date: tx.date.toLocaleDateString("fr-FR"),
    type: typeLabel(tx),
    parties: hasParties(tx) ? partiesOf(tx, myPublicKey, contacts) : null,
    amount: tx.money.length,
  }
}
