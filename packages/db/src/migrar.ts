import { existsSync } from 'node:fs';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { backupPreMigracao, limparBackupsPreMigracao } from './backup.js';
import { abrirConexao, type Conexao } from './conexao.js';
import { semear } from './semear.js';
import { registradorSilencioso, type OpcoesBanco } from './tipos.js';

export class ErroDeMigracao extends Error {
  /** Mensagem pronta para o dialog do Electron, em linguagem de oficina. */
  readonly mensagemUsuario: string;
  readonly backup: string | null;

  constructor(mensagemUsuario: string, backup: string | null, causa: unknown) {
    super(mensagemUsuario, { cause: causa });
    this.name = 'ErroDeMigracao';
    this.mensagemUsuario = mensagemUsuario;
    this.backup = backup;
  }
}

export interface ResultadoPreparo extends Conexao {
  /** Caminho do backup tirado antes de migrar, ou null na primeira execucao. */
  backup: string | null;
  /** true quando o banco acabou de ser criado. */
  bancoNovo: boolean;
}

/**
 * Sequencia do boot, nesta ordem e sem pular etapa:
 *   1. backup do banco atual (se existir);
 *   2. aplicar as migrations;
 *   3. semear o que faltar.
 *
 * Se qualquer passo falhar, a conexao e fechada e o erro sobe com uma mensagem
 * que diz o que fazer. O app nao abre com banco meio migrado.
 */
export function prepararBanco(opcoes: OpcoesBanco): ResultadoPreparo {
  const registrador = opcoes.registrador ?? registradorSilencioso;
  const bancoNovo = !existsSync(opcoes.arquivoDb);

  let backup: string | null;
  try {
    backup = backupPreMigracao(opcoes.arquivoDb, opcoes.pastaBackups);
    if (backup) {
      registrador.info('[banco] backup antes de migrar:', backup);
      const removidos = limparBackupsPreMigracao(opcoes.pastaBackups);
      if (removidos > 0) registrador.info(`[banco] ${removidos} backup(s) antigo(s) removido(s)`);
    } else {
      registrador.info('[banco] primeira execução, criando o banco do zero');
    }
  } catch (causa) {
    registrador.error('[banco] falhou ao fazer o backup', causa);
    throw new ErroDeMigracao(
      'Não consegui fazer a cópia de segurança do banco antes de atualizar.\n\n' +
        'Confira se há espaço livre no disco e abra o sistema de novo. ' +
        'Se continuar, envie o diagnóstico em Configurações.',
      null,
      causa,
    );
  }

  let conexao: Conexao | null = null;
  try {
    conexao = abrirConexao(opcoes.arquivoDb);
    migrate(conexao.db, { migrationsFolder: opcoes.pastaMigrations });
    semear(conexao.db);
    registrador.info('[banco] pronto:', opcoes.arquivoDb);
    return { ...conexao, backup, bancoNovo };
  } catch (causa) {
    conexao?.fechar();
    registrador.error('[banco] falhou ao preparar o banco', causa);

    const ondeEstaOBackup = backup
      ? `\n\nSeus dados estão salvos em:\n${backup}`
      : '\n\nNenhum dado foi perdido: o banco ainda estava sendo criado.';

    throw new ErroDeMigracao(
      'Não consegui atualizar o banco de dados do sistema.' +
        ondeEstaOBackup +
        '\n\nFeche e abra o sistema de novo. Se continuar assim, ' +
        'envie o diagnóstico em Configurações.',
      backup,
      causa,
    );
  }
}
