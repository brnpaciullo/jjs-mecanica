import { z } from 'zod';

/**
 * recepcao -> diagnostico -> orcamento_enviado -> aprovado -> em_servico -> pronto -> entregue
 *                                              \-> recusado
 * Ir para tras e permitido (o usuario erra), mas a tela pede confirmacao.
 */
export const STATUS_ORDEM = [
  'recepcao',
  'diagnostico',
  'orcamento_enviado',
  'aprovado',
  'recusado',
  'em_servico',
  'pronto',
  'entregue',
] as const;

export const statusOrdemSchema = z.enum(STATUS_ORDEM);
export type StatusOrdem = z.infer<typeof statusOrdemSchema>;

/** Rotulo que aparece na tela. Nunca mostrar o valor cru do banco. */
export const ROTULO_STATUS: Record<StatusOrdem, string> = {
  recepcao: 'Recepção',
  diagnostico: 'Em diagnóstico',
  orcamento_enviado: 'Aguardando cliente',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  em_servico: 'Em serviço',
  pronto: 'Pronto',
  entregue: 'Entregue',
};

/** Colunas do quadro "Carros na oficina", na ordem. Entregue sai do quadro. */
export const COLUNAS_QUADRO: StatusOrdem[] = [
  'recepcao',
  'diagnostico',
  'orcamento_enviado',
  'aprovado',
  'em_servico',
  'pronto',
];

/** Ordem do fluxo, para saber se uma mudanca esta indo para tras. */
const POSICAO: Record<StatusOrdem, number> = {
  recepcao: 0,
  diagnostico: 1,
  orcamento_enviado: 2,
  aprovado: 3,
  recusado: 3,
  em_servico: 4,
  pronto: 5,
  entregue: 6,
};

export function ehVoltarStatus(de: StatusOrdem, para: StatusOrdem): boolean {
  return POSICAO[para] < POSICAO[de];
}

export const COMBUSTIVEL = ['reserva', '1/4', '1/2', '3/4', 'cheio'] as const;
export const combustivelSchema = z.enum(COMBUSTIVEL);
export type Combustivel = z.infer<typeof combustivelSchema>;

export const PAPEIS = ['admin', 'balcao', 'mecanico'] as const;
export const papelSchema = z.enum(PAPEIS);
export type Papel = z.infer<typeof papelSchema>;

export const TIPOS_ITEM = ['peca', 'mao_de_obra'] as const;
export const tipoItemSchema = z.enum(TIPOS_ITEM);
export type TipoItem = z.infer<typeof tipoItemSchema>;

export const ROTULO_TIPO_ITEM: Record<TipoItem, string> = {
  peca: 'Peças',
  mao_de_obra: 'Mão de obra',
};

export const CATEGORIAS = [
  'Mecânica em geral',
  'Freios',
  'Suspensão',
  'Motor',
  'Elétrica',
  'Ar-condicionado',
  'Câmbio',
] as const;
export const categoriaSchema = z.enum(CATEGORIAS);
export type Categoria = z.infer<typeof categoriaSchema>;

export const MOMENTOS_MIDIA = ['entrada', 'diagnostico', 'servico'] as const;
export const momentoMidiaSchema = z.enum(MOMENTOS_MIDIA);
export type MomentoMidia = z.infer<typeof momentoMidiaSchema>;

export const ROTULO_MOMENTO: Record<MomentoMidia, string> = {
  entrada: 'Entrada',
  diagnostico: 'Diagnóstico',
  servico: 'Serviço',
};

/**
 * O próximo passo natural do fluxo, para o botão "avançar" da tela da OS.
 * `recusado` e `entregue` são pontas: dali não se avança sozinho.
 */
export function proximoStatus(de: StatusOrdem): StatusOrdem | null {
  const fluxo: Partial<Record<StatusOrdem, StatusOrdem>> = {
    recepcao: 'diagnostico',
    diagnostico: 'orcamento_enviado',
    orcamento_enviado: 'aprovado',
    aprovado: 'em_servico',
    em_servico: 'pronto',
    pronto: 'entregue',
  };
  return fluxo[de] ?? null;
}

/** OS que saiu do quadro: o carro não está mais na oficina. */
export function saiuDaOficina(status: StatusOrdem): boolean {
  return status === 'entregue' || status === 'recusado';
}
