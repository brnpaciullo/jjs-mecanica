import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join, normalize, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { app, dialog } from 'electron';
import { open as abrirZip, type Entry, type ZipFile } from 'yauzl';
import { copiarBanco } from '@jjs/db';
import { fecharBanco } from '../banco.js';
import type { CaminhosApp } from '../caminhos.js';
import { log } from '../log.js';

export interface ConteudoBackup {
  temBanco: boolean;
  midias: number;
  geradoEm: string | null;
}

function abrir(arquivo: string): Promise<ZipFile> {
  return new Promise((resolver, rejeitar) => {
    abrirZip(arquivo, { lazyEntries: true }, (erro, zip) => {
      if (erro || !zip) {
        // O yauzl reclama em inglês técnico ("End of central directory record
        // signature not found"). Quem está no balcão só precisa saber que o
        // arquivo escolhido não serve.
        log.warn(`[restauração] não consegui abrir ${arquivo}`, erro);
        rejeitar(
          new Error(
            'Esse arquivo não é um backup válido da JJS Mecânica. ' +
              'Procure um arquivo que comece com "jjs-backup-" e termine em .zip.',
          ),
        );
        return;
      }
      resolver(zip);
    });
  });
}

/**
 * Recusa caminho que tenta sair da pasta de destino.
 *
 * Um zip pode conter entradas como `../../algo`, e extrair sem checar
 * sobrescreveria arquivos fora da pasta de dados. O backup normalmente vem da
 * própria oficina, mas "normalmente" não é garantia quando o arquivo pode ter
 * vindo de um pendrive.
 */
function destinoSeguro(raiz: string, nomeNoZip: string): string | null {
  const limpo = normalize(nomeNoZip).replace(/^(\.\.(\/|\\|$))+/, '');
  const completo = join(raiz, limpo);
  return completo.startsWith(raiz + sep) || completo === raiz ? completo : null;
}

/** Olha dentro do zip sem mexer em nada — para a tela poder avisar o que vem. */
export async function inspecionarBackup(arquivo: string): Promise<ConteudoBackup> {
  const zip = await abrir(arquivo);

  return new Promise((resolver, rejeitar) => {
    let temBanco = false;
    let midias = 0;

    zip.on('entry', (entrada: Entry) => {
      if (entrada.fileName === 'jjs.db') temBanco = true;
      if (entrada.fileName.startsWith('midias/') && !entrada.fileName.endsWith('/')) midias += 1;
      zip.readEntry();
    });
    zip.on('end', () => resolver({ temBanco, midias, geradoEm: null }));
    zip.on('error', rejeitar);
    zip.readEntry();
  });
}

async function extrair(
  arquivo: string,
  pastaDestino: string,
  aoExtrairBanco: string,
): Promise<number> {
  const zip = await abrir(arquivo);

  return new Promise((resolver, rejeitar) => {
    let extraidos = 0;

    zip.on('entry', (entrada: Entry) => {
      if (entrada.fileName.endsWith('/')) {
        zip.readEntry();
        return;
      }

      const ehBanco = entrada.fileName === 'jjs.db';
      const destino = ehBanco
        ? aoExtrairBanco
        : entrada.fileName.startsWith('midias/')
          ? destinoSeguro(pastaDestino, entrada.fileName.slice('midias/'.length))
          : null;

      // conteudo.json e qualquer coisa inesperada ficam de fora.
      if (!destino) {
        zip.readEntry();
        return;
      }

      zip.openReadStream(entrada, (erro, leitura) => {
        if (erro || !leitura) {
          rejeitar(erro ?? new Error('Falhou ao ler um arquivo de dentro do backup.'));
          return;
        }

        mkdirSync(dirname(destino), { recursive: true });
        pipeline(leitura, createWriteStream(destino))
          .then(() => {
            extraidos += 1;
            zip.readEntry();
          })
          .catch(rejeitar);
      });
    });

    zip.on('end', () => resolver(extraidos));
    zip.on('error', rejeitar);
    zip.readEntry();
  });
}

export interface ResultadoRestauracao {
  arquivosRestaurados: number;
  copiaDeSeguranca: string | null;
}

/**
 * Restaura um backup por cima dos dados atuais.
 *
 * A ordem importa e não pode ser trocada:
 *   1. copiar o banco atual para um "antes-de-restaurar" — se a restauração
 *      vier de um arquivo errado, ainda dá para voltar;
 *   2. fechar a conexão, senão o arquivo fica travado no Windows;
 *   3. extrair;
 *   4. reiniciar o app, porque metade do sistema já leu o banco antigo.
 *
 * As mídias são somadas, não substituídas: cada backup traz só as novas, então
 * apagar as existentes perderia tudo que veio nos backups anteriores.
 */
export async function restaurarBackup(
  arquivo: string,
  caminhos: CaminhosApp,
): Promise<ResultadoRestauracao> {
  if (!existsSync(arquivo)) throw new Error('Esse arquivo de backup não foi encontrado.');

  const conteudo = await inspecionarBackup(arquivo);
  if (!conteudo.temBanco && conteudo.midias === 0) {
    throw new Error('Esse arquivo não parece um backup da JJS Mecânica.');
  }

  const carimbo = new Date().toISOString().replace(/[:.]/g, '-').replace('Z', '');
  let copiaDeSeguranca: string | null = null;

  if (existsSync(caminhos.arquivoDb)) {
    mkdirSync(caminhos.backups, { recursive: true });
    copiaDeSeguranca = join(caminhos.backups, `antes-de-restaurar-${carimbo}.db`);
    copiarBanco(caminhos.arquivoDb, copiaDeSeguranca);
    log.info(`[restauração] banco atual salvo em ${copiaDeSeguranca}`);
  }

  fecharBanco();

  // O WAL e o SHM guardam escritas que ainda não entraram no .db. Deixá-los
  // no lugar faria o SQLite misturá-los com o banco restaurado.
  for (const extra of ['-wal', '-shm']) rmSync(`${caminhos.arquivoDb}${extra}`, { force: true });

  const bancoTemporario = `${caminhos.arquivoDb}.restaurando`;
  rmSync(bancoTemporario, { force: true });

  const arquivosRestaurados = await extrair(arquivo, caminhos.midias, bancoTemporario);

  if (conteudo.temBanco && existsSync(bancoTemporario)) {
    // Troca só no fim: se a extração falhar no meio, o banco atual fica intacto.
    rmSync(caminhos.arquivoDb, { force: true });
    renameSync(bancoTemporario, caminhos.arquivoDb);
    log.info('[restauração] banco substituído');
  }

  log.info(`[restauração] ${arquivosRestaurados} arquivo(s) restaurado(s); reiniciando`);
  return { arquivosRestaurados, copiaDeSeguranca };
}

/** Pergunta qual arquivo restaurar. */
export async function escolherBackup(caminhos: CaminhosApp): Promise<string | null> {
  const escolha = await dialog.showOpenDialog({
    title: 'Escolha o backup para restaurar',
    defaultPath: caminhos.backups,
    filters: [{ name: 'Backup da JJS', extensions: ['zip'] }],
    properties: ['openFile'],
  });

  return escolha.canceled ? null : (escolha.filePaths[0] ?? null);
}

/** Reinicia o app — obrigatório depois de restaurar. */
export function reiniciarApp(): void {
  app.relaunch();
  app.exit(0);
}
