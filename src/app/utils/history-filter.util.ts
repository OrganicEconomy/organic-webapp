import type { DisplayRow } from './transaction-display.util'

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

function wordsOf(row: DisplayRow): string {
  return searchableText(row.type)
}

export function matchesSearch(row: DisplayRow, search: string): boolean {
  return wordsOf(row).includes(searchableText(search))
}
