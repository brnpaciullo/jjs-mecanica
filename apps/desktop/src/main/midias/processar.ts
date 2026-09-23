import { existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { midias as tabelaMidias } from '@jjs/db';
import { obterBanco } from '../banco.js';
import type { CaminhosApp } from '../caminhos.js';
import { log } from '../log.js';
import { converterVideo, ffmpegDisponivel, gerarThumbDeVideo } from './video.js';

/** Lado maior da foto guardada. Acima disso não melhora nada num orçamento. */
const LADO_MAIOR_FOTO = 1920;
const LADO_THUMB = 400;

export interface MidiaSalva {
  id: number;
  arquivoPath: string;
  thumbPath: string | null;
  statusProcessamento: 'pendente' | 'pronto' | 'erro';
}

function pastaDaOrdem(caminhos: CaminhosApp, ordemId: number | null): string {
  const pasta = ordemId === null ? caminhos.midiasInbox : join(caminhos.midias, String(ordemId));
  mkdirSync(pasta, { recursive: true });
  return pasta;
}

/** Caminho relativo à pasta de mídias: o backup e a restauração dependem disso. */
function relativo(caminhos: CaminhosApp, absoluto: string): string {
  return absoluto.startsWith(caminhos.midias)
    ? absoluto
        .slice(caminhos.midias.length + 1)
        .split('\\')
        .join('/')
    : absoluto;
}

/**
 * Guarda uma foto: versão final com lado maior de 1920px e uma miniatura.
 *
 * O celular já manda reduzido (o mecânico está no 4G da oficina), mas a foto
 * pode vir do WhatsApp ou de outro caminho — então a redução acontece aqui
 * também. `rotate()` sem argumento aplica a orientação do EXIF: sem isso, foto
 * tirada de lado aparece deitada no orçamento.
 */
export async function salvarFoto(
  caminhos: CaminhosApp,
  ordemId: number | null,
  bytes: Buffer,
  opcoes: {
    momento?: 'entrada' | 'diagnostico' | 'servico';
    itemId?: number | null;
    legenda?: string | null;
    origem?: 'app' | 'whatsapp';
    criadoPor?: number | null;
  } = {},
): Promise<MidiaSalva> {
  const pasta = pastaDaOrdem(caminhos, ordemId);
  const base = `foto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const arquivo = join(pasta, `${base}.jpg`);
  const thumb = join(pasta, `${base}-thumb.jpg`);

  await sharp(bytes)
    .rotate()
    .resize(LADO_MAIOR_FOTO, LADO_MAIOR_FOTO, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(arquivo);

  await sharp(bytes)
    .rotate()
    .resize(LADO_THUMB, LADO_THUMB, { fit: 'cover' })
    .jpeg({ quality: 70 })
    .toFile(thumb);

  const registro = obterBanco()
    .insert(tabelaMidias)
    .values({
      ordemId,
      itemId: opcoes.itemId ?? null,
      tipo: 'foto',
      arquivoPath: relativo(caminhos, arquivo),
      thumbPath: relativo(caminhos, thumb),
      tamanhoBytes: statSync(arquivo).size,
      momento: opcoes.momento ?? 'servico',
      origem: opcoes.origem ?? 'app',
      statusProcessamento: 'pronto',
      legenda: opcoes.legenda ?? null,
      criadoPor: opcoes.criadoPor ?? null,
    })
    .returning()
    .get();

  log.info(`[mídias] foto ${registro.id} salva em ${registro.arquivoPath}`);
  return {
    id: registro.id,
    arquivoPath: registro.arquivoPath,
    thumbPath: registro.thumbPath,
    statusProcessamento: 'pronto',
  };
}

/**
 * Guarda um vídeo e enfileira a conversão.
 *
 * O registro nasce como `pendente` e o arquivo original é servido enquanto
 * isso: o mecânico não pode ficar esperando um vídeo converter para continuar
 * o serviço. A tela mostra "Processando vídeo..." até ficar pronto.
 */
export async function salvarVideo(
  caminhos: CaminhosApp,
  ordemId: number | null,
  origemArquivo: string,
  opcoes: {
    momento?: 'entrada' | 'diagnostico' | 'servico';
    itemId?: number | null;
    legenda?: string | null;
    origem?: 'app' | 'whatsapp';
    criadoPor?: number | null;
  } = {},
): Promise<MidiaSalva> {
  const pasta = pastaDaOrdem(caminhos, ordemId);
  const base = `video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const original = join(pasta, `${base}-original`);

  renameSync(origemArquivo, original);

  const registro = obterBanco()
    .insert(tabelaMidias)
    .values({
      ordemId,
      itemId: opcoes.itemId ?? null,
      tipo: 'video',
      arquivoPath: relativo(caminhos, original),
      thumbPath: null,
      tamanhoBytes: statSync(original).size,
      momento: opcoes.momento ?? 'servico',
      origem: opcoes.origem ?? 'app',
      statusProcessamento: ffmpegDisponivel() ? 'pendente' : 'pronto',
      legenda: opcoes.legenda ?? null,
      criadoPor: opcoes.criadoPor ?? null,
    })
    .returning()
    .get();

  if (ffmpegDisponivel()) {
    enfileirarConversao(
      caminhos,
      registro.id,
      original,
      join(pasta, `${base}.mp4`),
      join(pasta, `${base}-thumb.jpg`),
    );
  } else {
    log.warn('[mídias] ffmpeg indisponível: o vídeo fica no formato original');
  }

  return {
    id: registro.id,
    arquivoPath: registro.arquivoPath,
    thumbPath: null,
    statusProcessamento: registro.statusProcessamento,
  };
}

// A conversão roda uma de cada vez: ffmpeg come CPU, e o notebook da oficina
// também está atendendo o balcão e servindo o celular do mecânico.
const fila: Array<() => Promise<void>> = [];
let convertendo = false;

function enfileirarConversao(
  caminhos: CaminhosApp,
  midiaId: number,
  original: string,
  destino: string,
  thumb: string,
): void {
  fila.push(async () => {
    try {
      await converterVideo(original, destino);
      await gerarThumbDeVideo(destino, thumb);

      obterBanco()
        .update(tabelaMidias)
        .set({
          arquivoPath: relativo(caminhos, destino),
          thumbPath: relativo(caminhos, thumb),
          tamanhoBytes: statSync(destino).size,
          statusProcessamento: 'pronto',
        })
        .where(eq(tabelaMidias.id, midiaId))
        .run();

      // Só apaga o original depois que a conversão deu certo.
      rmSync(original, { force: true });
      log.info(`[mídias] vídeo ${midiaId} convertido`);
    } catch (erro) {
      log.error(`[mídias] falhou ao converter o vídeo ${midiaId}`, erro);
      // Marca como pronto mesmo assim: o original continua lá e é melhor
      // mostrar o vídeo pesado do que deixar o mecânico sem nada.
      obterBanco()
        .update(tabelaMidias)
        .set({ statusProcessamento: existsSync(original) ? 'pronto' : 'erro' })
        .where(eq(tabelaMidias.id, midiaId))
        .run();
    }
  });

  void processarFila();
}

async function processarFila(): Promise<void> {
  if (convertendo) return;
  convertendo = true;

  while (fila.length > 0) {
    const tarefa = fila.shift();
    if (tarefa) await tarefa();
  }

  convertendo = false;
}

export function tamanhoDaFilaDeVideo(): number {
  return fila.length + (convertendo ? 1 : 0);
}
