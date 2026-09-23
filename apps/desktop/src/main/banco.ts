import { dialog } from 'electron';
import { ErroDeMigracao, prepararBanco, reposConfig, type BancoJjs, type Conexao } from '@jjs/db';
import type { CaminhosApp } from './caminhos.js';
import { log } from './log.js';

let conexao: Conexao | null = null;
let usuarioPadraoId: number | null = null;

/**
 * Abre o banco no boot. A ordem importa: backup -> migrations -> seed.
 * Se falhar, mostra um aviso que diz o que fazer e o app nao abre com banco
 * pela metade.
 */
export function iniciarBanco(caminhos: CaminhosApp): BancoJjs {
  try {
    const resultado = prepararBanco({
      arquivoDb: caminhos.arquivoDb,
      pastaBackups: caminhos.backups,
      pastaMigrations: caminhos.migrations,
      registrador: log,
    });

    conexao = resultado;
    if (resultado.bancoNovo) log.info('[banco] banco criado nesta execução');

    // O desktop não pede login: tudo que é feito no balcão é assinado pelo
    // usuário admin semeado na primeira execução.
    const usuario = reposConfig.usuarioPadrao({ db: resultado.db, usuarioId: null });
    usuarioPadraoId = usuario?.id ?? null;
    log.info(
      `[banco] autoria do balcão: ${usuario?.nome ?? 'sem usuário'} (id ${usuarioPadraoId})`,
    );

    return resultado.db;
  } catch (erro) {
    const mensagem =
      erro instanceof ErroDeMigracao
        ? erro.mensagemUsuario
        : 'Não consegui abrir o banco de dados do sistema.\n\n' +
          'Feche e abra o sistema de novo. Se continuar assim, me envie o diagnóstico.';

    dialog.showErrorBox('JJS Mecânica não conseguiu iniciar', mensagem);
    throw erro;
  }
}

export function obterBanco(): BancoJjs {
  if (!conexao) throw new Error('O banco ainda não foi aberto.');
  return conexao.db;
}

/** Quem assina o que é feito no balcão. Ver iniciarBanco. */
export function obterUsuarioPadrao(): number | null {
  return usuarioPadraoId;
}

export function fecharBanco(): void {
  if (!conexao) return;
  log.info('[banco] fechando a conexão');
  conexao.fechar();
  conexao = null;
  usuarioPadraoId = null;
}
