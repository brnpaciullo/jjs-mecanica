import { and, desc, eq, like, or, sql } from 'drizzle-orm';
import { clienteSchema, normalizarTelefone, type NovoCliente } from '@jjs/core';
import { clientes, veiculos } from '../schema.js';
import { ErroDeNegocio, validar, type Contexto } from './contexto.js';

export type ClienteRegistro = typeof clientes.$inferSelect;

export function listarClientes(ctx: Contexto, termo = ''): ClienteRegistro[] {
  const busca = termo.trim();
  const filtros = [eq(clientes.arquivado, false)];

  if (busca) {
    const curinga = `%${busca}%`;
    // Telefone é buscado pelos dígitos: quem digita "(41) 99999" precisa achar.
    // Menos de 3 dígitos não vale como busca de telefone — "OS 1" casaria com
    // qualquer número que tenha o algarismo 1 e sujaria o Ctrl+K.
    const digitos = busca.replace(/\D/g, '');
    const porTelefone = digitos.length >= 3 ? [like(clientes.telefone, `%${digitos}%`)] : [];
    filtros.push(or(like(clientes.nome, curinga), ...porTelefone, like(clientes.cpf, curinga))!);
  }

  return ctx.db
    .select()
    .from(clientes)
    .where(and(...filtros))
    .orderBy(clientes.nome)
    .all();
}

export function buscarCliente(ctx: Contexto, id: number): ClienteRegistro | null {
  return ctx.db.select().from(clientes).where(eq(clientes.id, id)).get() ?? null;
}

/**
 * Procura pelo telefone já normalizado. Evita cadastrar o mesmo cliente duas
 * vezes quando ele volta meses depois.
 */
export function acharPorTelefone(ctx: Contexto, telefone: string): ClienteRegistro | null {
  const e164 = normalizarTelefone(telefone);
  if (!e164) return null;
  return ctx.db.select().from(clientes).where(eq(clientes.telefone, e164)).get() ?? null;
}

export function criarCliente(ctx: Contexto, entrada: NovoCliente): ClienteRegistro {
  const dados = validar(clienteSchema, entrada);

  const jaExiste = acharPorTelefone(ctx, dados.telefone);
  if (jaExiste && !jaExiste.arquivado) {
    throw new ErroDeNegocio(
      `Esse telefone já é do cliente ${jaExiste.nome}. Use o cadastro dele ou confira o número.`,
    );
  }

  return ctx.db.insert(clientes).values(dados).returning().get();
}

export function atualizarCliente(
  ctx: Contexto,
  id: number,
  entrada: Partial<NovoCliente>,
): ClienteRegistro {
  const atual = buscarCliente(ctx, id);
  if (!atual) throw new ErroDeNegocio('Esse cliente não foi encontrado.');

  const dados = validar(clienteSchema, {
    nome: entrada.nome ?? atual.nome,
    telefone: entrada.telefone ?? atual.telefone,
    cpf: entrada.cpf ?? atual.cpf,
    endereco: entrada.endereco ?? atual.endereco,
    observacoes: entrada.observacoes ?? atual.observacoes,
  });

  return ctx.db.update(clientes).set(dados).where(eq(clientes.id, id)).returning().get();
}

/** Nada é excluído: arquivar tira da lista mas mantém o histórico de pé. */
export function arquivarCliente(ctx: Contexto, id: number, arquivado = true): ClienteRegistro {
  const cliente = buscarCliente(ctx, id);
  if (!cliente) throw new ErroDeNegocio('Esse cliente não foi encontrado.');

  if (arquivado) {
    const [{ total } = { total: 0 }] = ctx.db
      .select({ total: sql<number>`count(*)` })
      .from(veiculos)
      .where(and(eq(veiculos.clienteId, id), eq(veiculos.arquivado, false)))
      .all();
    if (total > 0) {
      throw new ErroDeNegocio(
        `${cliente.nome} ainda tem ${total} carro(s) no cadastro. Arquive os carros antes.`,
      );
    }
  }

  return ctx.db.update(clientes).set({ arquivado }).where(eq(clientes.id, id)).returning().get();
}

export function clientesRecentes(ctx: Contexto, limite = 20): ClienteRegistro[] {
  return ctx.db
    .select()
    .from(clientes)
    .where(eq(clientes.arquivado, false))
    .orderBy(desc(clientes.criadoEm))
    .limit(limite)
    .all();
}
