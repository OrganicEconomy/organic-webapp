import type { DisplayRow, Party } from './transaction-display.util'

export interface MonthHeading {
  heading: string
}

export type HistoryEntry = MonthHeading | DisplayRow

function startsAMonth(rows: DisplayRow[], index: number): boolean {
  return index === 0 || rows[index - 1].month !== rows[index].month
}

export function withMonthHeadings(rows: DisplayRow[]): HistoryEntry[] {
  return rows.flatMap((row, index): HistoryEntry[] =>
    startsAMonth(rows, index) ? [{ heading: row.month }, row] : [row],
  )
}

function searchableText(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

function partyWordsOf(party: Party): string[] {
  return party.fullKey ? [party.label, party.fullKey] : [party.label]
}

function amountWordsOf(row: DisplayRow): string[] {
  return Object.values(row.amounts)
    .filter((amount) => amount !== 0)
    .map((amount) => String(Math.abs(amount)))
}

function wordsOf(row: DisplayRow): string {
  const partyWords = row.parties ? [...partyWordsOf(row.parties.source), ...partyWordsOf(row.parties.target)] : []
  return searchableText([row.type, ...partyWords, ...amountWordsOf(row)].join(' '))
}

export function matchesSearch(row: DisplayRow, search: string): boolean {
  return wordsOf(row).includes(searchableText(search))
}

export function hasType(row: DisplayRow, type: string | null): boolean {
  return type === null || row.type === type
}
