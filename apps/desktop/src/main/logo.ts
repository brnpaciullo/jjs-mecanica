import { copyFileSync, existsSync, readFileSync, unlinkSync } from 'node:fs';
import { extname, join } from 'node:path';
import { dialog } from 'electron';
import { reposConfig } from '@jjs/db';
import { obterBanco, obterUsuarioPadrao } from './banco.js';
import type { CaminhosApp } from './caminhos.js';
import { log } from './log.js';

const EXTENSOES = ['png', 'jpg', 'jpeg', 'webp'];
const TAMANHO_MAXIMO = 5 * 1024 * 1024;

/**
 * O logo é copiado para dentro da pasta de dados, e não referenciado onde o
 * usuário escolheu. Se ficasse apontando para a Área de Trabalho, bastaria ele
 * mover o arquivo para o cabeçalho do orçamento sumir — e o backup não levaria
 * a imagem junto.
 */
export async function escolherLogo(caminhos: CaminhosApp): Promise<string | null> {
  const escolha = await dialog.showOpenDialog({
    title: 'Escolha o logo da oficina',
    filters: [{ name: 'Imagens', extensions: EXTENSOES }],
    properties: ['openFile'],
  });

  const origem = escolha.filePaths[0];
  if (escolha.canceled || !origem) return null;

  const extensao = extname(origem).toLowerCase().replace('.', '');
  if (!EXTENSOES.includes(extensao)) {
    throw new Error('Escolha uma imagem PNG, JPG ou WEBP.');
  }

  const bytes = readFileSync(origem);
  if (bytes.byteLength > TAMANHO_MAXIMO) {
    throw new Error('Essa imagem é muito grande. Use uma de até 5 MB.');
  }

  const destino = join(caminhos.userData, `logo.${extensao}`);
  copyFileSync(origem, destino);

  // Troca de formato: apaga o logo antigo para não sobrar lixo na pasta.
  for (const outra of EXTENSOES) {
    const antigo = join(caminhos.userData, `logo.${outra}`);
    if (antigo !== destino && existsSync(antigo)) unlinkSync(antigo);
  }

  reposConfig.salvarConfig(
    { db: obterBanco(), usuarioId: obterUsuarioPadrao() },
    { logoPath: destino },
  );

  log.info(`[logo] gravado em ${destino}`);
  return destino;
}

export function removerLogo(caminhos: CaminhosApp): void {
  for (const extensao of EXTENSOES) {
    const arquivo = join(caminhos.userData, `logo.${extensao}`);
    if (existsSync(arquivo)) unlinkSync(arquivo);
  }
  reposConfig.salvarConfig(
    { db: obterBanco(), usuarioId: obterUsuarioPadrao() },
    { logoPath: null },
  );
  log.info('[logo] removido');
}

/**
 * Logo como data URI. É assim que ele entra no template do PDF: a janela oculta
 * que renderiza o orçamento não tem permissão para ler `file://` sob a CSP, e
 * embutir a imagem evita depender de caminho absoluto.
 */
export function logoComoDataUri(logoPath: string | null): string | null {
  if (!logoPath || !existsSync(logoPath)) return null;

  const extensao = extname(logoPath).toLowerCase().replace('.', '');
  const tipo = extensao === 'jpg' ? 'jpeg' : extensao;
  const base64 = readFileSync(logoPath).toString('base64');
  return `data:image/${tipo};base64,${base64}`;
}
