/**
 * Dinheiro sempre em centavos (inteiro). Nunca float.
 * O banco guarda centavos; a tela mostra "R$ 1.234,56".
 */

const FORMATADOR = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const FORMATADOR_SEM_SIMBOLO = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 123456 -> "R$ 1.234,56" */
export function formatarDinheiro(centavos: number): string {
  return FORMATADOR.format(centavos / 100);
}

/** 123456 -> "1.234,56" (para tabelas do PDF, onde o R$ fica no cabecalho) */
export function formatarDinheiroSemSimbolo(centavos: number): string {
  return FORMATADOR_SEM_SIMBOLO.format(centavos / 100);
}

/**
 * Le um valor digitado em pt-BR e devolve centavos.
 * Aceita "R$ 1.234,56", "1234,56", "1.234", "1234", "12.50".
 * Devolve null quando nao da para entender.
 *
 * Regra do ponto sem virgula: se depois do ultimo ponto vierem exatamente 3
 * digitos, o ponto e separador de milhar ("1.234" = mil duzentos e trinta e
 * quatro reais). Caso contrario e separador decimal ("12.50" = doze e cinquenta).
 */
export function lerDinheiro(texto: string): number | null {
  if (typeof texto !== 'string') return null;

  const limpo = texto.trim().replace(/\s/g, '').replace(/^R\$/i, '');
  if (limpo === '') return null;

  const negativo = limpo.startsWith('-');
  const semSinal = negativo ? limpo.slice(1) : limpo;

  if (!/^[\d.,]+$/.test(semSinal)) return null;

  let inteiros: string;
  let decimais: string;

  if (semSinal.includes(',')) {
    const corte = semSinal.lastIndexOf(',');
    inteiros = semSinal.slice(0, corte).replace(/[.,]/g, '');
    decimais = semSinal.slice(corte + 1).replace(/[.,]/g, '');
  } else if (semSinal.includes('.')) {
    const corte = semSinal.lastIndexOf('.');
    const depois = semSinal.slice(corte + 1);
    if (depois.length === 3) {
      inteiros = semSinal.replace(/\./g, '');
      decimais = '';
    } else {
      inteiros = semSinal.slice(0, corte).replace(/\./g, '');
      decimais = depois;
    }
  } else {
    inteiros = semSinal;
    decimais = '';
  }

  if (inteiros === '' && decimais === '') return null;
  if (decimais.length > 2) return null;

  const centavosDecimais = Number(decimais.padEnd(2, '0') || '0');
  const centavosInteiros = Number(inteiros || '0') * 100;
  if (!Number.isFinite(centavosDecimais) || !Number.isFinite(centavosInteiros)) return null;

  const total = centavosInteiros + centavosDecimais;
  return negativo ? -total : total;
}

/**
 * Modo caixa registradora: so os digitos importam e os dois ultimos sao os
 * centavos. Digitar "12350" vira R$ 123,50. E o jeito mais rapido de lancar
 * preco no balcao sem errar a virgula.
 */
export function digitosParaCentavos(texto: string): number {
  const digitos = (texto ?? '').replace(/\D/g, '');
  if (digitos === '') return 0;
  return Number(digitos);
}

/** Multiplica valor unitario por quantidade mantendo centavos inteiros. */
export function multiplicarCentavos(centavos: number, quantidade: number): number {
  return Math.round(centavos * quantidade);
}
