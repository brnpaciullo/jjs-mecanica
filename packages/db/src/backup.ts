import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

const PREFIXO_PRE_MIGRACAO = 'pre-migracao-';

/** ISO sem ':' e sem '.', porque o Windows nao aceita esses caracteres em nome de arquivo. */
function carimbo(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * Copia consistente do banco usando VACUUM INTO: o SQLite gera um .db integro
 * num so arquivo, sem precisar juntar o -wal e o -shm na mao.
 * Devolve o caminho do backup, ou null se ainda nao existe banco para copiar.
 */
export function copiarBanco(arquivoDb: string, destino: string): string | null {
  if (!existsSync(arquivoDb)) return null;

  const origem = new Database(arquivoDb, { readonly: true });
  try {
    origem.prepare('VACUUM INTO ?').run(destino);
  } finally {
    origem.close();
  }
  return destino;
}

/** Backup tirado logo antes de aplicar migrations. E a rede de seguranca do update. */
export function backupPreMigracao(arquivoDb: string, pastaBackups: string): string | null {
  if (!existsSync(arquivoDb)) return null;
  mkdirSync(pastaBackups, { recursive: true });
  const destino = join(pastaBackups, `${PREFIXO_PRE_MIGRACAO}${carimbo()}.db`);
  return copiarBanco(arquivoDb, destino);
}

/** Mantem so os N backups de migracao mais recentes, para nao encher o disco. */
export function limparBackupsPreMigracao(pastaBackups: string, manter = 10): number {
  if (!existsSync(pastaBackups)) return 0;

  const arquivos = readdirSync(pastaBackups)
    .filter((n) => n.startsWith(PREFIXO_PRE_MIGRACAO) && n.endsWith('.db'))
    .map((nome) => {
      const caminho = join(pastaBackups, nome);
      return { caminho, mtime: statSync(caminho).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);

  const excedente = arquivos.slice(manter);
  for (const arquivo of excedente) {
    rmSync(arquivo.caminho, { force: true });
  }
  return excedente.length;
}
