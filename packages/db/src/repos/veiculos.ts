import { and, eq, like, or } from 'drizzle-orm';
import { normalizarPlaca, veiculoSchema, type NovoVeiculo } from '@jjs/core';
import { clientes, veiculos } from '../schema.js';
import { ErroDeNegocio, validar, type Contexto } from './contexto.js';

export type VeiculoRegistro = typeof veiculos.$inferSelect;
/** Veículo já com o dono junto: é assim que as telas quase sempre precisam. */
export type VeiculoComDono = VeiculoRegistro & { clienteNome: string; clienteTelefone: string };

const COM_DONO = {
  id: veiculos.id,
  clienteId: veiculos.clienteId,
  marca: veiculos.marca,
  modelo: veiculos.modelo,
  ano: veiculos.ano,
  placa: veiculos.placa,
  cor: veiculos.cor,
  kmAtual: veiculos.kmAtual,
  observacoes: veiculos.observacoes,
  arquivado: veiculos.arquivado,
  criadoEm: veiculos.criadoEm,
  clienteNome: clientes.nome,
  clienteTelefone: clientes.telefone,
};

export function listarVeiculos(ctx: Contexto, termo = ''): VeiculoComDono[] {
  const busca = termo.trim();
  const filtros = [eq(veiculos.arquivado, false)];

  if (busca) {
    const curinga = `%${busca}%`;
    // A placa é comparada normalizada: quem digita "abc-1234" acha "ABC1234".
    const placa = `%${normalizarPlaca(busca)}%`;
    filtros.push(
      or(
        like(veiculos.placa, placa),
        like(veiculos.modelo, curinga),
        like(veiculos.marca, curinga),
        like(clientes.nome, curinga),
      )!,
    );
  }

  return ctx.db
    .select(COM_DONO)
    .from(veiculos)
    .innerJoin(clientes, eq(veiculos.clienteId, clientes.id))
    .where(and(...filtros))
    .orderBy(veiculos.modelo)
    .all();
}

export function buscarVeiculo(ctx: Contexto, id: number): VeiculoComDono | null {
  return (
    ctx.db
      .select(COM_DONO)
      .from(veiculos)
      .innerJoin(clientes, eq(veiculos.clienteId, clientes.id))
      .where(eq(veiculos.id, id))
      .get() ?? null
  );
}

export function veiculosDoCliente(ctx: Contexto, clienteId: number): VeiculoRegistro[] {
  return ctx.db
    .select()
    .from(veiculos)
    .where(and(eq(veiculos.clienteId, clienteId), eq(veiculos.arquivado, false)))
    .orderBy(veiculos.modelo)
    .all();
}

/** Busca exata por placa. É o atalho que o balcão mais usa. */
export function acharPorPlaca(ctx: Contexto, placa: string): VeiculoComDono | null {
  const normalizada = normalizarPlaca(placa);
  if (!normalizada) return null;
  return (
    ctx.db
      .select(COM_DONO)
      .from(veiculos)
      .innerJoin(clientes, eq(veiculos.clienteId, clientes.id))
      .where(eq(veiculos.placa, normalizada))
      .get() ?? null
  );
}

export function criarVeiculo(ctx: Contexto, entrada: NovoVeiculo): VeiculoRegistro {
  const dados = validar(veiculoSchema, entrada);

  const jaExiste = acharPorPlaca(ctx, dados.placa);
  if (jaExiste && !jaExiste.arquivado) {
    throw new ErroDeNegocio(
      `Essa placa já está cadastrada: ${jaExiste.marca} ${jaExiste.modelo} do cliente ${jaExiste.clienteNome}.`,
    );
  }

  return ctx.db.insert(veiculos).values(dados).returning().get();
}

export function atualizarVeiculo(
  ctx: Contexto,
  id: number,
  entrada: Partial<NovoVeiculo>,
): VeiculoRegistro {
  const atual = ctx.db.select().from(veiculos).where(eq(veiculos.id, id)).get();
  if (!atual) throw new ErroDeNegocio('Esse carro não foi encontrado.');

  const dados = validar(veiculoSchema, {
    clienteId: entrada.clienteId ?? atual.clienteId,
    marca: entrada.marca ?? atual.marca,
    modelo: entrada.modelo ?? atual.modelo,
    placa: entrada.placa ?? atual.placa,
    ano: entrada.ano ?? atual.ano,
    cor: entrada.cor ?? atual.cor,
    kmAtual: entrada.kmAtual ?? atual.kmAtual,
    observacoes: entrada.observacoes ?? atual.observacoes,
  });

  return ctx.db.update(veiculos).set(dados).where(eq(veiculos.id, id)).returning().get();
}

export function arquivarVeiculo(ctx: Contexto, id: number, arquivado = true): VeiculoRegistro {
  const atual = ctx.db.select().from(veiculos).where(eq(veiculos.id, id)).get();
  if (!atual) throw new ErroDeNegocio('Esse carro não foi encontrado.');
  return ctx.db.update(veiculos).set({ arquivado }).where(eq(veiculos.id, id)).returning().get();
}

/** Atualiza o km rodado. Chamado quando a OS é entregue. */
export function registrarKm(ctx: Contexto, id: number, km: number): void {
  if (!Number.isFinite(km) || km < 0) return;
  ctx.db
    .update(veiculos)
    .set({ kmAtual: Math.round(km) })
    .where(eq(veiculos.id, id))
    .run();
}
