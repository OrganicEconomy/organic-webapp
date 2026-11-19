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

function isCashedBill(tx: any, myPublicKey: string): boolean {
  return tx.type === TxType.PAPER && tx.signer !== myPublicKey
}

function typeLabel(tx: any, myPublicKey: string): string {
  if (isCashing(tx)) {
    return "Encaissement"
  }
  if (tx.type === TxType.PAPER) {
    return isCashedBill(tx, myPublicKey) ? "Billet encaissé" : "Billet imprimé"
  }
  return TX_TYPE_LABELS[tx.type] ?? String(tx.type)
}

export interface Party {
  label: string
  fullKey: string | null
}

export interface Parties {
  source: Party
  target: Party
}

export interface Amounts {
  money: number
  invests: number
  experience: number
}

export interface DisplayRow {
  date: string
  type: string
  icon: string
  parties: Parties | null
  amounts: Amounts
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

const MONEY_SPENDINGS = [TxType.PAY, TxType.PAPER]

function moneyOf(tx: any, myPublicKey: string): number {
  if (tx.type === TxType.CREATE) {
    return tx.money.length
  }
  if (MONEY_SPENDINGS.includes(tx.type) && tx.signer === myPublicKey) {
    return -tx.money.length
  }
  return 0
}

function investsOf(tx: any, myPublicKey: string): number {
  if (tx.type === TxType.CREATE) {
    return tx.invests.length
  }
  if (tx.type === TxType.ENGAGE && tx.signer === myPublicKey) {
    return -tx.invests.length
  }
  return 0
}

const EXPERIENCE_GAINS = [TxType.PAY, TxType.EARN]

function experienceOf(tx: any, myPublicKey: string): number {
  if (EXPERIENCE_GAINS.includes(tx.type) && tx.target === myPublicKey) {
    return tx.money.length
  }
  if (isCashedBill(tx, myPublicKey)) {
    return tx.money.length
  }
  return 0
}

function amountsOf(tx: any, myPublicKey: string): Amounts {
  return {
    money: moneyOf(tx, myPublicKey),
    invests: investsOf(tx, myPublicKey),
    experience: experienceOf(tx, myPublicKey),
  }
}

const TX_TYPE_ICONS: Record<number, string> = {
  [TxType.INIT]: "bi-person-plus",
  [TxType.CREATE]: "bi-stars",
  [TxType.ENGAGE]: "bi-piggy-bank",
  [TxType.SETADMIN]: "bi-person-badge",
  [TxType.SETACTOR]: "bi-person-badge",
  [TxType.SETPAYER]: "bi-person-badge",
  [TxType.UNSETADMIN]: "bi-person-badge",
  [TxType.UNSETACTOR]: "bi-person-badge",
  [TxType.UNSETPAYER]: "bi-person-badge",
  [TxType.PAYERORDER]: "bi-receipt",
  [TxType.EARN]: "bi-briefcase",
}

function paymentIcon(tx: any, myPublicKey: string): string {
  if (isCashing(tx)) {
    return "bi-arrow-repeat"
  }
  return tx.signer === myPublicKey ? "bi-arrow-up-right" : "bi-arrow-down-left"
}

function iconOf(tx: any, myPublicKey: string): string {
  if (tx.type === TxType.PAY) {
    return paymentIcon(tx, myPublicKey)
  }
  if (tx.type === TxType.PAPER) {
    return isCashedBill(tx, myPublicKey) ? "bi-qr-code-scan" : "bi-printer"
  }
  return TX_TYPE_ICONS[tx.type] ?? "bi-question-circle"
}

export function toDisplayRow(tx: any, myPublicKey: string, contacts: any[]): DisplayRow {
  return {
    date: tx.date.toLocaleDateString("fr-FR"),
    type: typeLabel(tx, myPublicKey),
    icon: iconOf(tx, myPublicKey),
    parties: hasParties(tx) ? partiesOf(tx, myPublicKey, contacts) : null,
    amounts: amountsOf(tx, myPublicKey),
  }
}

export function withSign(amount: number): string {
  if (amount > 0) {
    return `+${amount}`
  }
  return amount < 0 ? `−${-amount}` : "0"
}

export function withoutRepeats(history: any[]): any[] {
  const seen = new Set<string>()
  return history.filter((tx) => {
    if (seen.has(tx.signature)) {
      return false
    }
    seen.add(tx.signature)
    return true
  })
}
