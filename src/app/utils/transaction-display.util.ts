export function getContactName(pk: string, myPublicKey: string, contacts: any[]): string {
  if (!pk) return "-"
  if (pk === myPublicKey) return "Moi"
  const contact: any = contacts.find((c: any) => c.pk === pk)
  return contact ? contact.name : "..." + pk.slice(-8)
}

export const TX_TYPE_LABELS: Record<string, string> = {
  "1": "Initialisation",
  "2": "Création",
  "3": "Paiement",
  "4": "Engagement",
  "5": "Billet",
  "6": "Assignation Admin",
  "7": "Assignation Acteur",
  "8": "Assignation Payeur",
  "9": "Suppression Admin",
  "10": "Suppression Acteur",
  "11": "Suppression Payeur",
}

export function toDisplayRow(tx: any, myPublicKey: string, contacts: any[]) {
  return {
    date: tx.date.toLocaleDateString("fr-FR"),
    type: TX_TYPE_LABELS[tx.type] ?? tx.type,
    source: getContactName(tx.signer, myPublicKey, contacts),
    target: getContactName(tx.target, myPublicKey, contacts),
    amount: tx.money.length,
  }
}
