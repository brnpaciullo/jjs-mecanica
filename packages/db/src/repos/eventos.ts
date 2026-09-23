import { eq } from 'drizzle-orm';
import type { StatusOrdem } from '@jjs/core';
import { ordemEventos, usuarios } from '../schema.js';
import type { Contexto } from './contexto.js';

export type EventoRegistro = typeof ordemEventos.$inferSelect;
export type EventoNaTela = EventoRegistro & { usuarioNome: string | null };

export interface NovoEvento {
  ordemId: number;
  tipo: EventoRegistro['tipo'];
  /** Já escrito em linguagem de oficina: vai direto para a linha do tempo. */
  descricao: string;
  statusDe?: StatusOrdem | null;
  statusPara?: StatusOrdem | null;
}

export function registrarEvento(ctx: Contexto, evento: NovoEvento): void {
  ctx.db
    .insert(ordemEventos)
    .values({
      ordemId: evento.ordemId,
      tipo: evento.tipo,
      descricao: evento.descricao,
      statusDe: evento.statusDe ?? null,
      statusPara: evento.statusPara ?? null,
      usuarioId: ctx.usuarioId,
    })
    .run();
}

/** Linha do tempo da OS, do mais antigo para o mais novo. */
export function listarEventos(ctx: Contexto, ordemId: number): EventoNaTela[] {
  return ctx.db
    .select({
      id: ordemEventos.id,
      ordemId: ordemEventos.ordemId,
      tipo: ordemEventos.tipo,
      descricao: ordemEventos.descricao,
      statusDe: ordemEventos.statusDe,
      statusPara: ordemEventos.statusPara,
      usuarioId: ordemEventos.usuarioId,
      criadoEm: ordemEventos.criadoEm,
      usuarioNome: usuarios.nome,
    })
    .from(ordemEventos)
    .leftJoin(usuarios, eq(ordemEventos.usuarioId, usuarios.id))
    .where(eq(ordemEventos.ordemId, ordemId))
    .orderBy(ordemEventos.criadoEm, ordemEventos.id)
    .all();
}
