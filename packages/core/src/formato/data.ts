/**
 * No banco tudo e ISO 8601. Na tela tudo e dd/mm/aaaa, no fuso do notebook.
 * Nunca usar toISOString() para exibir: ela devolve UTC e vira o dia errado
 * a noite.
 */

export function agoraISO(): string {
  return new Date().toISOString();
}

function paraDate(valor: string | Date): Date | null {
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

const dois = (n: number): string => String(n).padStart(2, '0');

/** ISO -> "22/09/2026" */
export function formatarData(iso: string | Date): string {
  const d = paraDate(iso);
  if (!d) return '';
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** ISO -> "22/09/2026 14:30" */
export function formatarDataHora(iso: string | Date): string {
  const d = paraDate(iso);
  if (!d) return '';
  return `${formatarData(d)} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

/** ISO -> "14:30" */
export function formatarHora(iso: string | Date): string {
  const d = paraDate(iso);
  if (!d) return '';
  return `${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

/** "22/09/2026" -> ISO do inicio daquele dia no fuso local. Invalida vira null. */
export function lerData(texto: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((texto ?? '').trim());
  if (!m) return null;

  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);

  const d = new Date(ano, mes - 1, dia, 0, 0, 0, 0);
  // Rejeita 31/02: o Date rola para marco e a data volta diferente.
  if (d.getDate() !== dia || d.getMonth() !== mes - 1 || d.getFullYear() !== ano) return null;

  return d.toISOString();
}

/** Soma dias a uma data ISO e devolve ISO. Usado na validade do orcamento. */
export function somarDias(iso: string | Date, dias: number): string {
  const d = paraDate(iso) ?? new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString();
}

/**
 * Quantos dias o carro esta na oficina, contando dias de calendario:
 * entrou ontem as 23h e agora e 1h da manha -> 1 dia, nao zero.
 */
export function diasNaOficina(isoEntrada: string | Date, referencia?: string | Date): number {
  const entrada = paraDate(isoEntrada);
  if (!entrada) return 0;
  const agora = paraDate(referencia ?? new Date()) ?? new Date();

  const a = new Date(entrada.getFullYear(), entrada.getMonth(), entrada.getDate());
  const b = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Texto curto para o card do quadro: "hoje", "1 dia", "12 dias". */
export function formatarDiasNaOficina(
  isoEntrada: string | Date,
  referencia?: string | Date,
): string {
  const dias = diasNaOficina(isoEntrada, referencia);
  if (dias <= 0) return 'hoje';
  if (dias === 1) return '1 dia';
  return `${dias} dias`;
}

/** Ja passou da validade do orcamento? */
export function estaVencido(
  isoValidade: string | null | undefined,
  referencia?: string | Date,
): boolean {
  if (!isoValidade) return false;
  const validade = paraDate(isoValidade);
  if (!validade) return false;
  const agora = paraDate(referencia ?? new Date()) ?? new Date();
  return agora.getTime() > validade.getTime();
}
