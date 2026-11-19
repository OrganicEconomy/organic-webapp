const LIGATURES: Record<string, string> = { œ: 'oe', æ: 'ae' }

export function comparable(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[œæ]/g, (ligature) => LIGATURES[ligature])
}
