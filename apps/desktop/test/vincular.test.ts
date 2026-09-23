// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { schema, clientes, ordens, veiculos } from '@jjs/db';
import type { Contexto } from '@jjs/db';
import {
  acharOrdemPelaLegenda,
  esquecerLegenda,
  legendaHerdada,
  lembrarLegenda,
} from '../src/main/whatsapp/vincular.js';

/**
 * O vínculo por legenda é a parte mais frágil da etapa 7: se ele não entender
 * o jeito como o mecânico escreve, as fotos ficam paradas na caixa "sem OS" e
 * o atalho perde a graça.
 *
 * Roda contra um **SQLite de verdade, em memória** — o better-sqlite3 é
 * Node-API e carrega tanto no Electron quanto no Node do vitest. Assim as
 * consultas também são exercitadas, e não só o texto.
 */
function bancoDeTeste(): Contexto {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');

  const pasta = join(process.cwd(), 'packages/db/src/migrations');
  for (const arquivo of readdirSync(pasta)
    .filter((n) => n.endsWith('.sql'))
    .sort()) {
    const sql = readFileSync(join(pasta, arquivo), 'utf8');
    for (const comando of sql.split('--> statement-breakpoint')) {
      if (comando.trim()) sqlite.exec(comando);
    }
  }

  return { db: drizzle(sqlite, { schema }), usuarioId: null };
}

/** Monta um carro com uma OS no status pedido. */
function comCarroEOs(
  ctx: Contexto,
  placa: string,
  numero: number,
  status: string,
): { ordemId: number } {
  const cliente = ctx.db
    .insert(clientes)
    .values({ nome: 'Maria', telefone: `5541999${numero}`.padEnd(13, '0') })
    .returning()
    .get();

  const carro = ctx.db
    .insert(veiculos)
    .values({ clienteId: cliente.id, marca: 'VW', modelo: 'Gol', placa })
    .returning()
    .get();

  const ordem = ctx.db
    .insert(ordens)
    .values({
      numero,
      clienteId: cliente.id,
      veiculoId: carro.id,
      status: status as 'em_servico',
      queixas: 'barulho',
    })
    .returning()
    .get();

  return { ordemId: ordem.id };
}

let ctx: Contexto;
beforeEach(() => {
  ctx = bancoDeTeste();
  esquecerLegenda();
});

describe('pelo número da OS', () => {
  it('entende como a oficina escreve', () => {
    const { ordemId } = comCarroEOs(ctx, 'ABC1234', 142, 'em_servico');
    for (const texto of ['OS 142', 'os142', 'OS142', '#142', 'os 142', '142']) {
      expect(acharOrdemPelaLegenda(ctx, texto)?.ordemId, texto).toBe(ordemId);
    }
  });

  it('acha o número no meio de uma frase', () => {
    const { ordemId } = comCarroEOs(ctx, 'ABC1234', 142, 'em_servico');
    const r = acharOrdemPelaLegenda(ctx, 'troquei a pastilha, OS 142, ficou ok');
    expect(r?.ordemId).toBe(ordemId);
    expect(r?.por).toBe('numero');
  });

  it('funciona mesmo com a OS já entregue — o número é exato', () => {
    const { ordemId } = comCarroEOs(ctx, 'ABC1234', 50, 'entregue');
    expect(acharOrdemPelaLegenda(ctx, 'OS 50')?.ordemId).toBe(ordemId);
  });

  it('número que não existe não vincula', () => {
    comCarroEOs(ctx, 'ABC1234', 142, 'em_servico');
    expect(acharOrdemPelaLegenda(ctx, 'OS 999')).toBeNull();
  });

  it('legenda sem nada reconhecível não vincula', () => {
    comCarroEOs(ctx, 'ABC1234', 142, 'em_servico');
    expect(acharOrdemPelaLegenda(ctx, 'ficou pronto')).toBeNull();
    expect(acharOrdemPelaLegenda(ctx, '')).toBeNull();
    expect(acharOrdemPelaLegenda(ctx, '   ')).toBeNull();
  });
});

describe('pela placa', () => {
  it('acha a OS aberta do carro', () => {
    const { ordemId } = comCarroEOs(ctx, 'ABC1234', 142, 'em_servico');
    const r = acharOrdemPelaLegenda(ctx, 'ABC-1234 disco riscado');
    expect(r?.ordemId).toBe(ordemId);
    expect(r?.por).toBe('placa');
  });

  it('aceita sem hífen e em minúscula', () => {
    const { ordemId } = comCarroEOs(ctx, 'ABC1234', 142, 'em_servico');
    expect(acharOrdemPelaLegenda(ctx, 'abc1234')?.ordemId).toBe(ordemId);
  });

  it('aceita placa Mercosul', () => {
    const { ordemId } = comCarroEOs(ctx, 'ABC1D23', 200, 'diagnostico');
    expect(acharOrdemPelaLegenda(ctx, 'foto do ABC1D23')?.ordemId).toBe(ordemId);
  });

  it('carro sem OS aberta não vincula — a placa identifica o carro, não o atendimento', () => {
    comCarroEOs(ctx, 'ABC1234', 142, 'entregue');
    expect(acharOrdemPelaLegenda(ctx, 'ABC-1234')).toBeNull();
  });

  it('OS recusada também não conta como aberta', () => {
    comCarroEOs(ctx, 'ABC1234', 142, 'recusado');
    expect(acharOrdemPelaLegenda(ctx, 'ABC1234')).toBeNull();
  });

  it('com várias abertas no mesmo carro, pega a mais recente', () => {
    const cliente = ctx.db
      .insert(clientes)
      .values({ nome: 'Maria', telefone: '5541999887766' })
      .returning()
      .get();
    const carro = ctx.db
      .insert(veiculos)
      .values({ clienteId: cliente.id, marca: 'VW', modelo: 'Gol', placa: 'ABC1234' })
      .returning()
      .get();
    for (const [numero, status] of [
      [10, 'pronto'],
      [88, 'em_servico'],
    ] as const) {
      ctx.db
        .insert(ordens)
        .values({ numero, clienteId: cliente.id, veiculoId: carro.id, status, queixas: 'x' })
        .run();
    }
    expect(acharOrdemPelaLegenda(ctx, 'ABC1234')?.numero).toBe(88);
  });

  it('placa que não existe não vincula', () => {
    comCarroEOs(ctx, 'ABC1234', 142, 'em_servico');
    expect(acharOrdemPelaLegenda(ctx, 'XYZ9876')).toBeNull();
  });
});

describe('legenda herdada pelas mídias seguintes', () => {
  afterEach(() => vi.useRealTimers());

  it('a foto seguinte, sem legenda, herda a anterior', () => {
    lembrarLegenda('OS 142', { ordemId: 7, por: 'numero', numero: 142 });
    expect(legendaHerdada()?.vinculo?.ordemId).toBe(7);
  });

  it('não herda nada quando não houve legenda antes', () => {
    expect(legendaHerdada()).toBeNull();
  });

  it('esquece depois de 2 minutos — senão a foto do carro seguinte cairia na OS errada', () => {
    lembrarLegenda('OS 142', { ordemId: 7, por: 'numero', numero: 142 });

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 3 * 60 * 1000);
    expect(legendaHerdada()).toBeNull();
  });

  it('dentro da janela ainda vale', () => {
    lembrarLegenda('OS 142', { ordemId: 7, por: 'numero', numero: 142 });

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 60 * 1000);
    expect(legendaHerdada()?.vinculo?.ordemId).toBe(7);
  });
});
