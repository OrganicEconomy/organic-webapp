import { TxType } from 'organic-protocol'
import { unitIdToDateInt } from 'organic-money/src/crypto.js'

function abbreviatedKey(pk: string): string {
  return "..." + pk.slice(-8)
}

export function displayNameOf(pk: string, myPublicKey: string, contacts: any[]): string {
  if (!pk) return "-"
  if (pk === myPublicKey) return "Moi"
  const contact: any = contacts.find((contact: any) => contact.pk === pk)
  return contact ? contact.name : abbreviatedKey(pk)
}

function isSignedByMe(tx: any, myPublicKey: string): boolean {
  return tx.signer === myPublicKey
}

function isReceivedByMe(tx: any, myPublicKey: string): boolean {
  return tx.target === myPublicKey
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

function isPaymentToOneself(tx: any): boolean {
  return tx.type === TxType.PAY && tx.signer === tx.target
}

function isBillCashedByMe(tx: any, myPublicKey: string): boolean {
  return tx.type === TxType.PAPER && !isSignedByMe(tx, myPublicKey)
}

function typeLabel(tx: any, myPublicKey: string): string {
  if (isPaymentToOneself(tx)) {
    return "Encaissement"
  }
  if (tx.type === TxType.PAPER) {
    return isBillCashedByMe(tx, myPublicKey) ? "Billet encaissé" : "Billet imprimé"
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

export interface Engagement {
  invests: number
  days: number
  isSpreadEvenly: boolean
}

export interface Amounts {
  money: number
  invests: number
  experience: number
}

export interface DisplayRow {
  date: string
  label: string
  icon: string
  parties: Parties | null
  amounts: Amounts
  engagement: Engagement | null
}

function isUnknownKey(pk: string, myPublicKey: string, contacts: any[]): boolean {
  return !!pk && pk !== myPublicKey && !contacts.some((contact: any) => contact.pk === pk)
}

function partyOf(pk: string, myPublicKey: string, contacts: any[]): Party {
  if (isUnknownKey(pk, myPublicKey, contacts)) {
    return { label: abbreviatedKey(pk), fullKey: pk }
  }
  return { label: displayNameOf(pk, myPublicKey, contacts), fullKey: null }
}

function receiverKeyOf(tx: any, myPublicKey: string): string {
  return isBillCashedByMe(tx, myPublicKey) ? myPublicKey : tx.target
}

function partiesOf(tx: any, myPublicKey: string, contacts: any[]): Parties {
  return {
    source: partyOf(tx.signer, myPublicKey, contacts),
    target: partyOf(receiverKeyOf(tx, myPublicKey), myPublicKey, contacts),
  }
}

const TYPES_WITHOUT_PARTIES = [TxType.INIT, TxType.CREATE]

function isBillPrintedByMe(tx: any, myPublicKey: string): boolean {
  return tx.type === TxType.PAPER && isSignedByMe(tx, myPublicKey)
}

function hasParties(tx: any, myPublicKey: string): boolean {
  return !TYPES_WITHOUT_PARTIES.includes(tx.type) && !isPaymentToOneself(tx) && !isBillPrintedByMe(tx, myPublicKey)
}

const TYPES_SPENDING_MONEY = [TxType.PAY, TxType.PAPER]

function moneyOf(tx: any, myPublicKey: string): number {
  if (tx.type === TxType.CREATE) {
    return tx.money.length
  }
  if (TYPES_SPENDING_MONEY.includes(tx.type) && isSignedByMe(tx, myPublicKey)) {
    return -tx.money.length
  }
  return 0
}

function investsOf(tx: any): number {
  return tx.type === TxType.CREATE ? tx.invests.length : 0
}

const TYPES_BRINGING_EXPERIENCE = [TxType.PAY, TxType.EARN]

function experienceOf(tx: any, myPublicKey: string): number {
  if (TYPES_BRINGING_EXPERIENCE.includes(tx.type) && isReceivedByMe(tx, myPublicKey)) {
    return tx.money.length
  }
  if (isBillCashedByMe(tx, myPublicKey)) {
    return tx.money.length
  }
  return 0
}

function amountsOf(tx: any, myPublicKey: string): Amounts {
  return {
    money: moneyOf(tx, myPublicKey),
    invests: investsOf(tx),
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
  if (isPaymentToOneself(tx)) {
    return "bi-arrow-repeat"
  }
  return isSignedByMe(tx, myPublicKey) ? "bi-arrow-up-right" : "bi-arrow-down-left"
}

function iconOf(tx: any, myPublicKey: string): string {
  if (tx.type === TxType.PAY) {
    return paymentIcon(tx, myPublicKey)
  }
  if (tx.type === TxType.PAPER) {
    return isBillCashedByMe(tx, myPublicKey) ? "bi-qr-code-scan" : "bi-printer"
  }
  return TX_TYPE_ICONS[tx.type] ?? "bi-question-circle"
}

function countsPerDay(unitIds: number[]): number[] {
  const counts = new Map<number, number>()
  for (const id of unitIds) {
    const day = unitIdToDateInt(id)
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  return [...counts.values()]
}

function engagementOf(tx: any): Engagement | null {
  if (tx.type !== TxType.ENGAGE || tx.invests.length === 0) {
    return null
  }
  const counts = countsPerDay(tx.invests)
  return {
    invests: tx.invests.length,
    days: counts.length,
    isSpreadEvenly: counts.every((count) => count === counts[0]),
  }
}

export function toDisplayRow(tx: any, myPublicKey: string, contacts: any[]): DisplayRow {
  return {
    date: tx.date.toLocaleDateString("fr-FR"),
    label: typeLabel(tx, myPublicKey),
    icon: iconOf(tx, myPublicKey),
    parties: hasParties(tx, myPublicKey) ? partiesOf(tx, myPublicKey, contacts) : null,
    amounts: amountsOf(tx, myPublicKey),
    engagement: engagementOf(tx),
  }
}

const MINUS_SIGN = "−"

export function withSign(amount: number): string {
  if (amount > 0) {
    return `+${amount}`
  }
  return amount < 0 ? `${MINUS_SIGN}${-amount}` : "0"
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
