import type { Contact } from '../models/account'

/** Falls back to a truncated key when the public key isn't in the citizen's own contacts. */
export function resolveContactName(pk: string, contacts: Contact[]): string {
  const contact = contacts.find((c) => c.pk === pk)
  if (contact) return contact.name
  return `${pk.slice(0, 8)}…`
}
