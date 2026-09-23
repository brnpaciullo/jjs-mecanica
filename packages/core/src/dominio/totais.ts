import { multiplicarCentavos } from '../formato/dinheiro.js';
import type { TipoItem } from './status.js';

/** O mínimo que um item precisa ter para entrar na conta. */
export interface ItemCalculavel {
  tipo: TipoItem;
  quantidade: number;
  valorUnitarioCentavos: number;
  aprovado: boolean;
}

export interface Totais {
  subtotalPecasCentavos: number;
  subtotalMaoDeObraCentavos: number;
  subtotalCentavos: number;
  /** Desconto já limitado ao subtotal: o total nunca fica negativo. */
  descontoCentavos: number;
  totalCentavos: number;
  /** Quantos itens foram deixados de fora por não estarem aprovados. */
  itensNaoAprovados: number;
}

/** Quanto este item soma sozinho. Sempre inteiro. */
export function totalItem(
  item: Pick<ItemCalculavel, 'quantidade' | 'valorUnitarioCentavos'>,
): number {
  return multiplicarCentavos(item.valorUnitarioCentavos, item.quantidade);
}

/**
 * Total da OS.
 *
 * **Só soma os itens aprovados.** É o que sustenta a aprovação parcial: o
 * cliente aprova a troca da pastilha e recusa a do disco, e o valor precisa
 * cair na hora, na tela e no PDF.
 *
 * O desconto é limitado ao subtotal: um desconto digitado maior que a conta
 * zera o total em vez de virar valor negativo.
 */
export function calcularTotais(itens: readonly ItemCalculavel[], descontoCentavos = 0): Totais {
  let subtotalPecasCentavos = 0;
  let subtotalMaoDeObraCentavos = 0;
  let itensNaoAprovados = 0;

  for (const item of itens) {
    if (!item.aprovado) {
      itensNaoAprovados += 1;
      continue;
    }
    const valor = totalItem(item);
    if (item.tipo === 'peca') subtotalPecasCentavos += valor;
    else subtotalMaoDeObraCentavos += valor;
  }

  const subtotalCentavos = subtotalPecasCentavos + subtotalMaoDeObraCentavos;
  const desconto = Math.min(Math.max(Math.round(descontoCentavos), 0), subtotalCentavos);

  return {
    subtotalPecasCentavos,
    subtotalMaoDeObraCentavos,
    subtotalCentavos,
    descontoCentavos: desconto,
    totalCentavos: subtotalCentavos - desconto,
    itensNaoAprovados,
  };
}

/** 1 -> "OS 0001". É assim que a oficina chama a ordem, na tela e no PDF. */
export function formatarNumeroOs(numero: number): string {
  return `OS ${String(numero).padStart(4, '0')}`;
}

/**
 * Extrai o número da OS de um texto solto: "OS 142", "os142", "#142", "142".
 * Usado na busca global e, na etapa 7, na legenda das mídias do WhatsApp.
 */
export function lerNumeroOs(texto: string): number | null {
  const m = /^\s*(?:os\s*|#)?(\d{1,6})\s*$/i.exec(texto ?? '');
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 ? n : null;
}
