import { asc, eq, sql } from 'drizzle-orm';
import {
  calcularTotais,
  formatarDinheiro,
  itemOrdemSchema,
  type NovoItemOrdem,
  type Totais,
} from '@jjs/core';
import { itensOrdem, ordens } from '../schema.js';
import { registrarEvento } from './eventos.js';
import { ErroDeNegocio, validar, type Contexto } from './contexto.js';

export type ItemRegistro = typeof itensOrdem.$inferSelect;

export function listarItens(ctx: Contexto, ordemId: number): ItemRegistro[] {
  return ctx.db
    .select()
    .from(itensOrdem)
    .where(eq(itensOrdem.ordemId, ordemId))
    .orderBy(asc(itensOrdem.posicao), asc(itensOrdem.id))
    .all();
}

/**
 * Totais da OS. A conta em si vive em @jjs/core (com testes); aqui só juntamos
 * os itens e o desconto. É a mesma função que o PDF e o mobile vão chamar.
 */
export function totaisDaOrdem(ctx: Contexto, ordemId: number): Totais {
  const ordem = ctx.db.select().from(ordens).where(eq(ordens.id, ordemId)).get();
  if (!ordem) throw new ErroDeNegocio('Essa OS não foi encontrada.');
  return calcularTotais(listarItens(ctx, ordemId), ordem.descontoCentavos);
}

export function adicionarItem(
  ctx: Contexto,
  ordemId: number,
  entrada: NovoItemOrdem,
): ItemRegistro {
  const ordem = ctx.db.select().from(ordens).where(eq(ordens.id, ordemId)).get();
  if (!ordem) throw new ErroDeNegocio('Essa OS não foi encontrada.');

  const dados = validar(itemOrdemSchema, entrada);

  const [{ maior } = { maior: 0 }] = ctx.db
    .select({ maior: sql<number>`coalesce(max(${itensOrdem.posicao}), -1)` })
    .from(itensOrdem)
    .where(eq(itensOrdem.ordemId, ordemId))
    .all();

  const item = ctx.db
    .insert(itensOrdem)
    .values({
      ordemId,
      tipo: dados.tipo,
      descricao: dados.descricao,
      quantidade: dados.quantidade,
      valorUnitarioCentavos: dados.valorUnitarioCentavos,
      observacao: dados.observacao ?? null,
      aprovado: dados.aprovado,
      posicao: maior + 1,
      criadoPor: ctx.usuarioId,
    })
    .returning()
    .get();

  registrarEvento(ctx, {
    ordemId,
    tipo: 'item',
    descricao: `Lançou "${item.descricao}" (${formatarDinheiro(item.valorUnitarioCentavos)})`,
  });

  return item;
}

export type ItemEditavel = Partial<
  Pick<
    ItemRegistro,
    'tipo' | 'descricao' | 'quantidade' | 'valorUnitarioCentavos' | 'observacao' | 'aprovado'
  >
>;

export function atualizarItem(ctx: Contexto, id: number, entrada: ItemEditavel): ItemRegistro {
  const atual = ctx.db.select().from(itensOrdem).where(eq(itensOrdem.id, id)).get();
  if (!atual) throw new ErroDeNegocio('Esse item não foi encontrado.');

  const dados = validar(itemOrdemSchema, {
    tipo: entrada.tipo ?? atual.tipo,
    descricao: entrada.descricao ?? atual.descricao,
    quantidade: entrada.quantidade ?? atual.quantidade,
    valorUnitarioCentavos: entrada.valorUnitarioCentavos ?? atual.valorUnitarioCentavos,
    observacao: entrada.observacao ?? atual.observacao,
    aprovado: entrada.aprovado ?? atual.aprovado,
  });

  const item = ctx.db
    .update(itensOrdem)
    .set({
      tipo: dados.tipo,
      descricao: dados.descricao,
      quantidade: dados.quantidade,
      valorUnitarioCentavos: dados.valorUnitarioCentavos,
      observacao: dados.observacao ?? null,
      aprovado: dados.aprovado,
    })
    .where(eq(itensOrdem.id, id))
    .returning()
    .get();

  // Aprovar ou desmarcar muda o total: fica registrado na linha do tempo.
  if (entrada.aprovado !== undefined && entrada.aprovado !== atual.aprovado) {
    registrarEvento(ctx, {
      ordemId: atual.ordemId,
      tipo: 'item',
      descricao: entrada.aprovado
        ? `Aprovou "${item.descricao}"`
        : `Tirou do orçamento "${item.descricao}"`,
    });
  }

  return item;
}

/**
 * Item de orçamento lançado errado é apagado mesmo, não arquivado: a regra de
 * "nada é excluído" existe para cliente, carro e OS — o histórico de verdade.
 * Uma linha digitada errada some, e a linha do tempo guarda que ela existiu.
 */
export function removerItem(ctx: Contexto, id: number): void {
  const atual = ctx.db.select().from(itensOrdem).where(eq(itensOrdem.id, id)).get();
  if (!atual) throw new ErroDeNegocio('Esse item não foi encontrado.');

  ctx.db.delete(itensOrdem).where(eq(itensOrdem.id, id)).run();

  registrarEvento(ctx, {
    ordemId: atual.ordemId,
    tipo: 'item',
    descricao: `Removeu "${atual.descricao}"`,
  });
}

/** Nova ordem dos itens depois de arrastar. Recebe os ids na ordem final. */
export function reordenarItens(ctx: Contexto, ordemId: number, idsNaOrdem: number[]): void {
  ctx.db.transaction((tx) => {
    idsNaOrdem.forEach((id, posicao) => {
      tx.update(itensOrdem).set({ posicao }).where(eq(itensOrdem.id, id)).run();
    });
  });
  void ordemId;
}

/** Marca ou desmarca todos de uma vez, para a tela de aprovação. */
export function definirAprovacaoDeTodos(
  ctx: Contexto,
  ordemId: number,
  aprovado: boolean,
): ItemRegistro[] {
  ctx.db.update(itensOrdem).set({ aprovado }).where(eq(itensOrdem.ordemId, ordemId)).run();
  registrarEvento(ctx, {
    ordemId,
    tipo: 'item',
    descricao: aprovado ? 'Aprovou todos os itens' : 'Desmarcou todos os itens',
  });
  return listarItens(ctx, ordemId);
}
