/**
 * Telefone guardado em E.164 ("5541999999999"), exibido como "(41) 99999-9999".
 * DDD 41 (Curitiba) e o padrao quando o cliente dita so o numero.
 */

export const DDD_PADRAO = '41';

/**
 * Devolve o numero em E.164 ou null se nao der para montar.
 * Aceita "99999-9999", "41999999999", "+55 41 99999-9999", "(41) 3333-4444".
 */
export function normalizarTelefone(texto: string, dddPadrao: string = DDD_PADRAO): string | null {
  let digitos = (texto ?? '').replace(/\D/g, '');
  if (digitos === '') return null;

  // So tira o 55 quando o tamanho indica codigo de pais; "55999998888" com 11
  // digitos e DDD 55 (RS) e nao pode perder o prefixo.
  if (digitos.length >= 12 && digitos.startsWith('55')) {
    digitos = digitos.slice(2);
  }

  // Sem DDD: 8 digitos (fixo) ou 9 digitos (celular).
  if (digitos.length === 8 || digitos.length === 9) {
    digitos = dddPadrao + digitos;
  }

  if (digitos.length !== 10 && digitos.length !== 11) return null;

  const ddd = digitos.slice(0, 2);
  if (Number(ddd) < 11) return null;

  const numero = digitos.slice(2);
  // Celular tem 9 digitos e comeca com 9; fixo tem 8 e comeca de 2 a 5.
  if (numero.length === 9 && !numero.startsWith('9')) return null;
  if (numero.length === 8 && !/^[2-5]/.test(numero)) return null;

  return `55${digitos}`;
}

export function ehTelefoneValido(texto: string, dddPadrao: string = DDD_PADRAO): boolean {
  return normalizarTelefone(texto, dddPadrao) !== null;
}

export function ehCelular(e164: string): boolean {
  const digitos = (e164 ?? '').replace(/\D/g, '');
  return digitos.length === 13 && digitos.startsWith('55');
}

/** "5541999999999" -> "(41) 99999-9999" */
export function formatarTelefone(e164: string): string {
  let digitos = (e164 ?? '').replace(/\D/g, '');
  if (digitos.length >= 12 && digitos.startsWith('55')) digitos = digitos.slice(2);

  if (digitos.length === 11) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  }
  if (digitos.length === 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return e164 ?? '';
}

/** Mascara progressiva enquanto a secretaria digita no campo. */
export function mascararTelefone(texto: string): string {
  const d = (texto ?? '').replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Numero para montar o link wa.me (sem o +). */
export function paraWhatsApp(e164: string): string {
  return (e164 ?? '').replace(/\D/g, '');
}
