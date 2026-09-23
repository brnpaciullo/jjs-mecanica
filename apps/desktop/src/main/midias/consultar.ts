import { and, eq, isNull } from 'drizzle-orm';
import { midias } from '@jjs/db';
import type { Contexto } from '@jjs/db';

export interface MidiaNaTela {
  id: number;
  ordemId: number | null;
  itemId: number | null;
  tipo: 'foto' | 'video';
  /** URL servida pelo servidor da LAN e pela tela do balcão. */
  url: string;
  thumbUrl: string | null;
  momento: 'entrada' | 'diagnostico' | 'servico';
  incluirParaCliente: boolean;
  statusProcessamento: 'pendente' | 'pronto' | 'erro';
  legenda: string | null;
  origem: 'app' | 'whatsapp';
  criadoEm: string;
}

/** O caminho é relativo no banco; a URL é montada na hora de exibir. */
function paraUrl(caminho: string | null): string | null {
  if (!caminho) return null;
  return `/midias/${caminho.split('\\').join('/')}`;
}

function converter(m: typeof midias.$inferSelect): MidiaNaTela {
  return {
    id: m.id,
    ordemId: m.ordemId,
    itemId: m.itemId,
    tipo: m.tipo,
    url: paraUrl(m.arquivoPath)!,
    thumbUrl: paraUrl(m.thumbPath),
    momento: m.momento,
    incluirParaCliente: m.incluirParaCliente,
    statusProcessamento: m.statusProcessamento,
    legenda: m.legenda,
    origem: m.origem,
    criadoEm: m.criadoEm,
  };
}

export function listarMidias(ctx: Contexto, ordemId: number): MidiaNaTela[] {
  return ctx.db
    .select()
    .from(midias)
    .where(eq(midias.ordemId, ordemId))
    .orderBy(midias.criadoEm)
    .all()
    .map(converter);
}

/** Mídias que chegaram sem OS identificada — a caixa de entrada da etapa 7. */
export function listarMidiasSemOs(ctx: Contexto): MidiaNaTela[] {
  return ctx.db
    .select()
    .from(midias)
    .where(isNull(midias.ordemId))
    .orderBy(midias.criadoEm)
    .all()
    .map(converter);
}

/** Fotos marcadas para o cliente — vão dentro do PDF do orçamento. */
export function fotosParaOCliente(ctx: Contexto, ordemId: number) {
  return ctx.db
    .select()
    .from(midias)
    .where(
      and(
        eq(midias.ordemId, ordemId),
        eq(midias.tipo, 'foto'),
        eq(midias.incluirParaCliente, true),
        eq(midias.statusProcessamento, 'pronto'),
      ),
    )
    .orderBy(midias.criadoEm)
    .all();
}

/** Vídeos marcados — vão soltos no WhatsApp, depois do PDF. */
export function videosParaOCliente(ctx: Contexto, ordemId: number) {
  return ctx.db
    .select()
    .from(midias)
    .where(
      and(
        eq(midias.ordemId, ordemId),
        eq(midias.tipo, 'video'),
        eq(midias.incluirParaCliente, true),
        eq(midias.statusProcessamento, 'pronto'),
      ),
    )
    .orderBy(midias.criadoEm)
    .all();
}

export function definirEnvioAoCliente(ctx: Contexto, midiaId: number, incluir: boolean) {
  return ctx.db
    .update(midias)
    .set({ incluirParaCliente: incluir })
    .where(eq(midias.id, midiaId))
    .returning()
    .get();
}

/** Anexa uma mídia solta a uma OS. Usado na caixa "Mídias sem OS". */
export function anexarMidiaAOrdem(ctx: Contexto, midiaId: number, ordemId: number) {
  return ctx.db.update(midias).set({ ordemId }).where(eq(midias.id, midiaId)).returning().get();
}
