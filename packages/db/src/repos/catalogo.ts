import { and, eq, like } from 'drizzle-orm';
import { catalogoSchema, type NovoCatalogo } from '@jjs/core';
import { catalogo } from '../schema.js';
import { ErroDeNegocio, validar, type Contexto } from './contexto.js';

export type CatalogoRegistro = typeof catalogo.$inferSelect;

export function listarCatalogo(ctx: Contexto, termo = ''): CatalogoRegistro[] {
  const busca = termo.trim();
  const filtros = [eq(catalogo.ativo, true)];
  if (busca) filtros.push(like(catalogo.descricao, `%${busca}%`));

  return ctx.db
    .select()
    .from(catalogo)
    .where(and(...filtros))
    .orderBy(catalogo.categoria, catalogo.descricao)
    .all();
}

/**
 * Sugestões para o autocompletar da tela da OS. Devolve poucos itens de
 * propósito: a lista é para escolher rápido, não para navegar.
 */
export function sugerirCatalogo(ctx: Contexto, termo: string, limite = 8): CatalogoRegistro[] {
  const busca = termo.trim();
  if (busca.length < 2) return [];
  return ctx.db
    .select()
    .from(catalogo)
    .where(and(eq(catalogo.ativo, true), like(catalogo.descricao, `%${busca}%`)))
    .orderBy(catalogo.descricao)
    .limit(limite)
    .all();
}

export function criarItemCatalogo(ctx: Contexto, entrada: NovoCatalogo): CatalogoRegistro {
  const dados = validar(catalogoSchema, entrada);
  return ctx.db.insert(catalogo).values(dados).returning().get();
}

export function atualizarItemCatalogo(
  ctx: Contexto,
  id: number,
  entrada: Partial<NovoCatalogo>,
): CatalogoRegistro {
  const atual = ctx.db.select().from(catalogo).where(eq(catalogo.id, id)).get();
  if (!atual) throw new ErroDeNegocio('Esse item do catálogo não foi encontrado.');

  const dados = validar(catalogoSchema, {
    descricao: entrada.descricao ?? atual.descricao,
    tipo: entrada.tipo ?? atual.tipo,
    valorPadraoCentavos: entrada.valorPadraoCentavos ?? atual.valorPadraoCentavos,
    categoria: entrada.categoria ?? atual.categoria,
  });

  return ctx.db.update(catalogo).set(dados).where(eq(catalogo.id, id)).returning().get();
}

export function arquivarItemCatalogo(ctx: Contexto, id: number, ativo = false): CatalogoRegistro {
  const atual = ctx.db.select().from(catalogo).where(eq(catalogo.id, id)).get();
  if (!atual) throw new ErroDeNegocio('Esse item do catálogo não foi encontrado.');
  return ctx.db.update(catalogo).set({ ativo }).where(eq(catalogo.id, id)).returning().get();
}
