import { eq } from 'drizzle-orm';
import { lerNumeroOs, normalizarPlaca, saiuDaOficina } from '@jjs/core';
import { ordens, veiculos } from '@jjs/db';
import type { Contexto } from '@jjs/db';

export interface Vinculo {
  ordemId: number;
  /** Como a OS foi identificada — vai no log e ajuda a explicar o que houve. */
  por: 'numero' | 'placa';
  numero: number;
}

/**
 * Descobre a qual OS uma legenda se refere.
 *
 * O mecânico escreve como fala: "OS 142", "os142", "#142", ou simplesmente a
 * placa. Tudo isso precisa funcionar — se ele tiver que digitar num formato
 * exato, vai parar de usar e as fotos ficam no celular dele.
 *
 * A placa só vale para **OS aberta**: uma placa identifica o carro, não o
 * atendimento, e um carro que já passou dez vezes pela oficina teria dez
 * candidatas. Com o carro na oficina agora, não há ambiguidade.
 */
export function acharOrdemPelaLegenda(ctx: Contexto, legenda: string): Vinculo | null {
  const texto = (legenda ?? '').trim();
  if (!texto) return null;

  // 1. Número explícito em qualquer lugar do texto: "trocou a pastilha, OS 142"
  const porNumero = /(?:\bos\s*|#)(\d{1,6})\b/i.exec(texto);
  const numeroSolto = porNumero ? Number(porNumero[1]) : lerNumeroOs(texto);

  if (numeroSolto !== null && numeroSolto > 0) {
    const ordem = ctx.db.select().from(ordens).where(eq(ordens.numero, numeroSolto)).get();
    if (ordem) return { ordemId: ordem.id, por: 'numero', numero: ordem.numero };
  }

  // 2. Placa de um carro que está na oficina agora
  const candidata = /\b([A-Za-z]{3}[-\s]?\d[A-Za-z0-9]\d{2})\b/.exec(texto);
  const placa = normalizarPlaca(candidata?.[1] ?? '');

  if (placa.length === 7) {
    const carro = ctx.db.select().from(veiculos).where(eq(veiculos.placa, placa)).get();
    if (carro) {
      const abertas = ctx.db
        .select()
        .from(ordens)
        .where(eq(ordens.veiculoId, carro.id))
        .all()
        .filter((o) => !saiuDaOficina(o.status))
        .sort((a, b) => b.numero - a.numero);

      const ordem = abertas[0];
      if (ordem) return { ordemId: ordem.id, por: 'placa', numero: ordem.numero };
    }
  }

  return null;
}

/**
 * Legendas em sequência.
 *
 * Quem manda cinco fotos do mesmo serviço escreve a legenda na primeira e
 * manda o resto sem texto — é como o WhatsApp é usado. Por isso a última
 * legenda vale por um tempo curto para as mídias que vierem logo atrás.
 */
const JANELA_MS = 2 * 60 * 1000;

let ultima: { legenda: string; vinculo: Vinculo | null; em: number } | null = null;

export function lembrarLegenda(legenda: string, vinculo: Vinculo | null): void {
  ultima = { legenda, vinculo, em: Date.now() };
}

/** Recupera a legenda recente, se ainda estiver dentro da janela. */
export function legendaHerdada(): { legenda: string; vinculo: Vinculo | null } | null {
  if (!ultima) return null;
  if (Date.now() - ultima.em > JANELA_MS) {
    ultima = null;
    return null;
  }
  return { legenda: ultima.legenda, vinculo: ultima.vinculo };
}

export function esquecerLegenda(): void {
  ultima = null;
}
