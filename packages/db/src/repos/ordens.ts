import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import {
  ROTULO_STATUS,
  ehVoltarStatus,
  formatarNumeroOs,
  saiuDaOficina,
  somarDias,
  type ChecklistEntrada,
  type Combustivel,
  type StatusOrdem,
} from '@jjs/core';
import { clientes, midias, ordens, veiculos } from '../schema.js';
import { lerConfig } from './config.js';
import { registrarEvento } from './eventos.js';
import { registrarKm } from './veiculos.js';
import { ErroDeNegocio, type Contexto } from './contexto.js';

export type OrdemRegistro = typeof ordens.$inferSelect;

/** OS com cliente e veículo juntos — o formato que as listas e o card usam. */
export interface OrdemNaLista {
  id: number;
  numero: number;
  status: StatusOrdem;
  queixas: string;
  criadoEm: string;
  clienteId: number;
  clienteNome: string;
  clienteTelefone: string;
  veiculoId: number;
  marca: string;
  modelo: string;
  placa: string;
  cor: string | null;
  totalMidias: number;
}

/** Coluna de timestamp correspondente a cada status. */
const CARIMBO: Record<StatusOrdem, keyof OrdemRegistro> = {
  recepcao: 'recepcaoEm',
  diagnostico: 'diagnosticoEm',
  orcamento_enviado: 'orcamentoEnviadoEm',
  aprovado: 'aprovadoEm',
  recusado: 'recusadoEm',
  em_servico: 'emServicoEm',
  pronto: 'prontoEm',
  entregue: 'entregueEm',
};

const CAMPOS_LISTA = {
  id: ordens.id,
  numero: ordens.numero,
  status: ordens.status,
  queixas: ordens.queixas,
  criadoEm: ordens.criadoEm,
  clienteId: ordens.clienteId,
  clienteNome: clientes.nome,
  clienteTelefone: clientes.telefone,
  veiculoId: ordens.veiculoId,
  marca: veiculos.marca,
  modelo: veiculos.modelo,
  placa: veiculos.placa,
  cor: veiculos.cor,
  totalMidias: sql<number>`(select count(*) from ${midias} where ${midias.ordemId} = ${ordens.id})`,
};

function comJoins(ctx: Contexto) {
  return ctx.db
    .select(CAMPOS_LISTA)
    .from(ordens)
    .innerJoin(clientes, eq(ordens.clienteId, clientes.id))
    .innerJoin(veiculos, eq(ordens.veiculoId, veiculos.id));
}

export interface NovaOrdemEntrada {
  clienteId: number;
  veiculoId: number;
  queixas: string;
  kmEntrada?: number | null;
  combustivel?: Combustivel | null;
  checklistEntrada?: ChecklistEntrada | null;
}

/**
 * Abre o atendimento. O número da OS é sequencial e vem de `max(numero) + 1`
 * **dentro da mesma transação** do insert — senão o balcão e o celular do
 * mecânico podem pegar o mesmo número ao abrir duas OS ao mesmo tempo.
 */
export function criarOrdem(ctx: Contexto, entrada: NovaOrdemEntrada): OrdemRegistro {
  const queixas = (entrada.queixas ?? '').trim();
  if (!queixas) {
    throw new ErroDeNegocio('Escreva o que o cliente relatou. É o que inicia o atendimento.');
  }

  const veiculo = ctx.db.select().from(veiculos).where(eq(veiculos.id, entrada.veiculoId)).get();
  if (!veiculo) throw new ErroDeNegocio('Esse carro não foi encontrado.');
  if (veiculo.clienteId !== entrada.clienteId) {
    throw new ErroDeNegocio('Esse carro está cadastrado em outro cliente.');
  }

  const ordem = ctx.db.transaction((tx) => {
    const [{ maior } = { maior: 0 }] = tx
      .select({ maior: sql<number>`coalesce(max(${ordens.numero}), 0)` })
      .from(ordens)
      .all();

    return tx
      .insert(ordens)
      .values({
        numero: maior + 1,
        clienteId: entrada.clienteId,
        veiculoId: entrada.veiculoId,
        status: 'recepcao',
        queixas,
        kmEntrada: entrada.kmEntrada ?? null,
        combustivel: entrada.combustivel ?? null,
        checklistEntrada: entrada.checklistEntrada ?? null,
        recepcaoEm: new Date().toISOString(),
        criadoPor: ctx.usuarioId,
      })
      .returning()
      .get();
  });

  registrarEvento(ctx, {
    ordemId: ordem.id,
    tipo: 'status',
    descricao: `${formatarNumeroOs(ordem.numero)} aberta na recepção`,
    statusPara: 'recepcao',
  });

  // O km de entrada também atualiza o cadastro do carro.
  if (entrada.kmEntrada) registrarKm(ctx, entrada.veiculoId, entrada.kmEntrada);

  return ordem;
}

export function buscarOrdem(ctx: Contexto, id: number): OrdemRegistro | null {
  return ctx.db.select().from(ordens).where(eq(ordens.id, id)).get() ?? null;
}

export function buscarOrdemPorNumero(ctx: Contexto, numero: number): OrdemRegistro | null {
  return ctx.db.select().from(ordens).where(eq(ordens.numero, numero)).get() ?? null;
}

export function detalharOrdem(ctx: Contexto, id: number): OrdemNaLista | null {
  return comJoins(ctx).where(eq(ordens.id, id)).get() ?? null;
}

/** Carros que estão na oficina agora: tudo que ainda não saiu. */
export function listarQuadro(ctx: Contexto): OrdemNaLista[] {
  const naOficina = [
    'recepcao',
    'diagnostico',
    'orcamento_enviado',
    'aprovado',
    'em_servico',
    'pronto',
  ] as const;
  return comJoins(ctx)
    .where(inArray(ordens.status, [...naOficina]))
    .orderBy(ordens.criadoEm)
    .all();
}

export interface FiltroHistorico {
  termo?: string;
  status?: StatusOrdem | null;
  de?: string | null;
  ate?: string | null;
  limite?: number;
}

export function listarHistorico(ctx: Contexto, filtro: FiltroHistorico = {}): OrdemNaLista[] {
  const condicoes = [];
  if (filtro.status) condicoes.push(eq(ordens.status, filtro.status));
  if (filtro.de) condicoes.push(gte(ordens.criadoEm, filtro.de));
  if (filtro.ate) condicoes.push(lte(ordens.criadoEm, filtro.ate));

  const consulta = condicoes.length ? comJoins(ctx).where(and(...condicoes)) : comJoins(ctx);

  return consulta
    .orderBy(desc(ordens.numero))
    .limit(filtro.limite ?? 200)
    .all();
}

/** Todas as OS de um carro, da mais nova para a mais antiga. */
export function ordensDoVeiculo(ctx: Contexto, veiculoId: number): OrdemNaLista[] {
  return comJoins(ctx).where(eq(ordens.veiculoId, veiculoId)).orderBy(desc(ordens.numero)).all();
}

export function ordensDoCliente(ctx: Contexto, clienteId: number): OrdemNaLista[] {
  return comJoins(ctx).where(eq(ordens.clienteId, clienteId)).orderBy(desc(ordens.numero)).all();
}

/** Campos que a tela da OS salva sozinha enquanto o usuário digita. */
export type OrdemEditavel = Partial<
  Pick<
    OrdemRegistro,
    | 'queixas'
    | 'diagnostico'
    | 'descontoCentavos'
    | 'prazoEstimado'
    | 'formaPagamento'
    | 'observacoesGerais'
    | 'kmEntrada'
    | 'combustivel'
    | 'pago'
  >
>;

export function atualizarOrdem(ctx: Contexto, id: number, entrada: OrdemEditavel): OrdemRegistro {
  const atual = buscarOrdem(ctx, id);
  if (!atual) throw new ErroDeNegocio('Essa OS não foi encontrada.');

  if (entrada.queixas !== undefined && !entrada.queixas.trim()) {
    throw new ErroDeNegocio('As queixas do cliente não podem ficar em branco.');
  }
  if (entrada.descontoCentavos !== undefined && entrada.descontoCentavos < 0) {
    throw new ErroDeNegocio('O desconto não pode ser negativo.');
  }

  return ctx.db
    .update(ordens)
    .set({ ...entrada, atualizadoEm: new Date().toISOString() })
    .where(eq(ordens.id, id))
    .returning()
    .get();
}

/**
 * Muda o status, carimba a data da etapa e escreve na linha do tempo.
 * Ir para trás é permitido (o usuário erra) — quem pede confirmação é a tela.
 */
export function mudarStatus(
  ctx: Contexto,
  id: number,
  novo: StatusOrdem,
  opcoes: { kmSaida?: number | null; formaPagamento?: string | null } = {},
): OrdemRegistro {
  const atual = buscarOrdem(ctx, id);
  if (!atual) throw new ErroDeNegocio('Essa OS não foi encontrada.');
  if (atual.status === novo) return atual;

  const agora = new Date().toISOString();
  const mudancas: Partial<typeof ordens.$inferInsert> = {
    status: novo,
    atualizadoEm: agora,
    // Só carimba a primeira passagem pela etapa: se voltar e avançar de novo,
    // a data original da etapa é o que interessa.
    [CARIMBO[novo]]: atual[CARIMBO[novo]] ?? agora,
  };

  // Ao enviar o orçamento, a validade passa a valer a partir de hoje.
  if (novo === 'orcamento_enviado') {
    const config = lerConfig(ctx);
    mudancas.validadeAte = somarDias(agora, config.validadeOrcamentoDias);
  }

  if (novo === 'entregue') {
    if (opcoes.formaPagamento) mudancas.formaPagamento = opcoes.formaPagamento;
    if (opcoes.kmSaida) registrarKm(ctx, atual.veiculoId, opcoes.kmSaida);
  }

  const atualizada = ctx.db.update(ordens).set(mudancas).where(eq(ordens.id, id)).returning().get();

  const voltou = ehVoltarStatus(atual.status, novo);
  registrarEvento(ctx, {
    ordemId: id,
    tipo: 'status',
    descricao: voltou
      ? `Voltou de ${ROTULO_STATUS[atual.status]} para ${ROTULO_STATUS[novo]}`
      : `${ROTULO_STATUS[atual.status]} → ${ROTULO_STATUS[novo]}`,
    statusDe: atual.status,
    statusPara: novo,
  });

  return atualizada;
}

/** Quantos carros há em cada coluna do quadro. */
export function contarPorStatus(ctx: Contexto): Record<string, number> {
  const linhas = ctx.db
    .select({ status: ordens.status, total: sql<number>`count(*)` })
    .from(ordens)
    .groupBy(ordens.status)
    .all();

  const contagem: Record<string, number> = {};
  for (const linha of linhas) {
    if (!saiuDaOficina(linha.status)) contagem[linha.status] = linha.total;
  }
  return contagem;
}
