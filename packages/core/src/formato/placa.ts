/**
 * Placa: aceita o formato antigo (ABC-1234) e o Mercosul (ABC1D23).
 * No banco fica normalizada: maiuscula, sem hifen e sem espaco.
 * Na tela volta formatada.
 */

export type TipoPlaca = 'antiga' | 'mercosul';

const ANTIGA = /^[A-Z]{3}\d{4}$/;
const MERCOSUL = /^[A-Z]{3}\d[A-Z]\d{2}$/;

/** "abc-1234" -> "ABC1234". Nao valida, so limpa. */
export function normalizarPlaca(texto: string): string {
  return (texto ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 7);
}

export function tipoPlaca(texto: string): TipoPlaca | null {
  const placa = normalizarPlaca(texto);
  if (ANTIGA.test(placa)) return 'antiga';
  if (MERCOSUL.test(placa)) return 'mercosul';
  return null;
}

export function ehPlacaValida(texto: string): boolean {
  return tipoPlaca(texto) !== null;
}

/** "ABC1234" -> "ABC-1234"; "ABC1D23" -> "ABC1D23". Invalida volta como veio. */
export function formatarPlaca(texto: string): string {
  const placa = normalizarPlaca(texto);
  if (ANTIGA.test(placa)) return `${placa.slice(0, 3)}-${placa.slice(3)}`;
  return placa;
}
