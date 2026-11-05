export interface SharedContact {
  pk: string;
  url: string;
  name: string;
}

export function contactLink(appBaseUrl: string, contact: SharedContact): string {
  const link = new URL('addcontact', appBaseUrl);
  link.search = new URLSearchParams({ pk: contact.pk, server: contact.url, name: contact.name }).toString();
  return link.href;
}
