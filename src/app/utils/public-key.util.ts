const COMPRESSED_PUBLIC_KEY = /^0[23][0-9a-f]{64}$/;

export const MALFORMED_PUBLIC_KEY_MESSAGE =
  "Cette clé publique n'est pas valide : elle doit faire 66 caractères (0-9, a-f) et commencer par 02 ou 03.";

export function isWellFormedPublicKey(pk: string): boolean {
  return COMPRESSED_PUBLIC_KEY.test(pk);
}
