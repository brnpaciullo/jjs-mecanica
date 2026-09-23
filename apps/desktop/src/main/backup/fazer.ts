import { createWriteStream, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { ZipArchive } from 'archiver';
import { copiarBanco } from '@jjs/db';
import type { CaminhosApp } from '../caminhos.js';
import { log } from '../log.js';
import { gravarIndice, lerIndice, type IndiceBackup } from './indice.js';

/** Quantos backups ficam guardados. O mais antigo some quando passa disso. */
export const QUANTOS_MANTER = 30;

export interface ResultadoBackup {
  arquivo: string;
  tamanhoBytes: number;
  midiasNovas: number;
  quandoEm: string;
}

/** ISO sem ':' nem '.', que o Windows não aceita em nome de arquivo. */
function carimbo(agora = new Date()): string {
  return agora.toISOString().replace(/[:.]/g, '-').replace('Z', '');
}

/** Lista recursiva de arquivos, com o caminho relativo à raiz. */
function listarArquivos(raiz: string): string[] {
  if (!existsSync(raiz)) return [];

  const encontrados: string[] = [];
  const andar = (pasta: string) => {
    for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
      const caminho = join(pasta, entrada.name);
      if (entrada.isDirectory()) andar(caminho);
      else if (entrada.isFile()) encontrados.push(relative(raiz, caminho));
    }
  };
  andar(raiz);
  return encontrados;
}

/**
 * Backup completo: banco inteiro + mídias novas, num zip só.
 *
 * O banco vai **sempre por inteiro** — ele é pequeno e é o que realmente não
 * pode ser perdido. As mídias vão **só as novas**, guiadas pelo índice: são
 * elas que pesam, e foto antiga não muda.
 *
 * A cópia do banco usa `VACUUM INTO`, que gera um arquivo íntegro mesmo com o
 * app escrevendo no mesmo instante. Copiar o `.db` na mão enquanto o WAL está
 * ativo produziria um banco corrompido.
 */
export async function fazerBackup(
  caminhos: CaminhosApp,
  pastaDestino?: string | null,
): Promise<ResultadoBackup> {
  const destino = pastaDestino?.trim() || caminhos.backups;
  mkdirSync(destino, { recursive: true });

  const agora = new Date();
  const indice = lerIndice(caminhos.backups);

  // 1. Cópia consistente do banco, num temporário dentro da pasta de dados.
  const bancoTemporario = join(caminhos.backups, `.banco-${carimbo(agora)}.db`);
  const copiou = copiarBanco(caminhos.arquivoDb, bancoTemporario);

  // 2. Só as mídias que ainda não foram, ou que mudaram de tamanho.
  const todasAsMidias = listarArquivos(caminhos.midias);
  const novas = todasAsMidias.filter((relativo) => {
    const chave = relativo.split(sep).join('/');
    const tamanho = statSync(join(caminhos.midias, relativo)).size;
    return indice.midias[chave] !== tamanho;
  });

  const arquivo = join(destino, `jjs-backup-${carimbo(agora)}.zip`);

  try {
    await new Promise<void>((resolver, rejeitar) => {
      const saida = createWriteStream(arquivo);
      // O archiver 8 expõe classes; a função `archiver('zip')` não existe mais.
      const zip = new ZipArchive({ zlib: { level: 6 } });

      saida.on('close', () => resolver());
      saida.on('error', rejeitar);
      zip.on('error', rejeitar);
      zip.on('warning', (aviso: unknown) => log.warn('[backup]', aviso));

      zip.pipe(saida);

      if (copiou) zip.file(bancoTemporario, { name: 'jjs.db' });
      for (const relativo of novas) {
        zip.file(join(caminhos.midias, relativo), {
          name: `midias/${relativo.split(sep).join('/')}`,
        });
      }

      // Deixa registrado o que este zip contém, para quem for restaurar.
      zip.append(
        JSON.stringify(
          {
            geradoEm: agora.toISOString(),
            banco: copiou ? 'jjs.db' : null,
            midiasNoZip: novas.length,
            midiasNoTotal: todasAsMidias.length,
            aviso:
              'As mídias deste backup são apenas as novas desde o backup anterior. ' +
              'Para restaurar tudo, mantenha os backups antigos.',
          },
          null,
          2,
        ),
        { name: 'conteudo.json' },
      );

      void zip.finalize();
    });
  } finally {
    rmSync(bancoTemporario, { force: true });
  }

  // 3. Só marca como salvo depois que o zip fechou de verdade.
  const novoIndice: IndiceBackup = {
    midias: { ...indice.midias },
    ultimoBackupEm: agora.toISOString(),
  };
  for (const relativo of novas) {
    const chave = relativo.split(sep).join('/');
    novoIndice.midias[chave] = statSync(join(caminhos.midias, relativo)).size;
  }
  gravarIndice(caminhos.backups, novoIndice);

  limparAntigos(destino);

  const tamanhoBytes = statSync(arquivo).size;
  log.info(
    `[backup] ${arquivo} (${Math.round(tamanhoBytes / 1024)} KB, ${novas.length} mídia(s) nova(s))`,
  );

  return { arquivo, tamanhoBytes, midiasNovas: novas.length, quandoEm: agora.toISOString() };
}

/** Mantém os N zips mais recentes; o resto sai para não encher o disco. */
function limparAntigos(pasta: string, manter = QUANTOS_MANTER): number {
  if (!existsSync(pasta)) return 0;

  const zips = readdirSync(pasta)
    .filter((n) => n.startsWith('jjs-backup-') && n.endsWith('.zip'))
    .map((nome) => ({ caminho: join(pasta, nome), mtime: statSync(join(pasta, nome)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  const excedente = zips.slice(manter);
  for (const zip of excedente) rmSync(zip.caminho, { force: true });
  if (excedente.length > 0)
    log.info(`[backup] ${excedente.length} backup(s) antigo(s) removido(s)`);
  return excedente.length;
}

export interface BackupNaTela {
  arquivo: string;
  nome: string;
  tamanhoBytes: number;
  quandoEm: string;
}

/** Backups existentes, do mais novo para o mais antigo. */
export function listarBackups(caminhos: CaminhosApp, pastaDestino?: string | null): BackupNaTela[] {
  const destino = pastaDestino?.trim() || caminhos.backups;
  if (!existsSync(destino)) return [];

  return readdirSync(destino)
    .filter((n) => n.startsWith('jjs-backup-') && n.endsWith('.zip'))
    .map((nome) => {
      const caminho = join(destino, nome);
      const info = statSync(caminho);
      return {
        arquivo: caminho,
        nome,
        tamanhoBytes: info.size,
        quandoEm: new Date(info.mtimeMs).toISOString(),
      };
    })
    .sort((a, b) => b.quandoEm.localeCompare(a.quandoEm));
}
