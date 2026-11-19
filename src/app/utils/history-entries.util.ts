import type { DisplayRow, Party } from './transaction-display.util'
import { comparable } from './comparable-text.util'

export interface MonthHeading {
  heading: string
}

export type HistoryEntry = MonthHeading | DisplayRow

export function isMonthHeading(entry: HistoryEntry): entry is MonthHeading {
  return 'heading' in entry
}

function startsAMonth(rows: DisplayRow[], index: number): boolean {
  return index === 0 || rows[index - 1].month !== rows[index].month
}

export function withMonthHeadings(rows: DisplayRow[]): HistoryEntry[] {
  return rows.flatMap((row, index): HistoryEntry[] =>
    startsAMonth(rows, index) ? [{ heading: row.month }, row] : [row],
  )
}

function partyWordsOf(party: Party): string[] {
  return party.fullKey ? [party.label, party.fullKey] : [party.label]
}

function partiesWordsOf(row: DisplayRow): string[] {
  return row.parties ? [...partyWordsOf(row.parties.source), ...partyWordsOf(row.parties.target)] : []
}

function searchableTextOf(row: DisplayRow): string {
  return comparable([row.label, ...partiesWordsOf(row), row.date, row.month].join(' '))
}

const SIGNED_NUMBER = /^[+\-−]?\d+$/

function isAnAmount(word: string): boolean {
  return SIGNED_NUMBER.test(word)
}

function hasAmount(row: DisplayRow, word: string): boolean {
  const searched = Math.abs(Number(word.replace('−', '-')))
  return Object.values(row.amounts).some((amount) => amount !== 0 && Math.abs(amount) === searched)
}

function wordsSearched(search: string): string[] {
  return comparable(search).split(/\s+/).filter(Boolean)
}

export function matchesSearch(row: DisplayRow, search: string): boolean {
  const text = searchableTextOf(row)
  return wordsSearched(search).every((word) => (isAnAmount(word) ? hasAmount(row, word) : text.includes(word)))
}

export const ALL_TYPES = 'Tous les types'

export function matchesType(row: DisplayRow, chosenType: string): boolean {
  return chosenType === ALL_TYPES || row.label === chosenType
}
