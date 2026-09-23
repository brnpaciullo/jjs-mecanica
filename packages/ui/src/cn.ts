/** Junta classes ignorando falsy. Evita puxar uma dependencia so para isso. */
export function cn(...partes: Array<string | false | null | undefined>): string {
  return partes.filter(Boolean).join(' ');
}
