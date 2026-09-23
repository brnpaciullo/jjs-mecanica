import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { schema } from './schema.js';
import type { BancoJjs } from './tipos.js';

export interface Conexao {
  db: BancoJjs;
  sqlite: Database.Database;
  fechar: () => void;
}

/**
 * Abre o banco com os PRAGMAs que o app precisa:
 * - WAL: o servidor da LAN le enquanto o balcao escreve, sem travar.
 * - foreign_keys: o SQLite deixa desligado por padrao.
 * - busy_timeout: em vez de estourar "database is locked", espera 5s.
 */
export function abrirConexao(arquivoDb: string): Conexao {
  mkdirSync(dirname(arquivoDb), { recursive: true });

  const sqlite = new Database(arquivoDb);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('synchronous = NORMAL');

  const db = drizzle(sqlite, { schema });

  return {
    db,
    sqlite,
    fechar: () => {
      if (sqlite.open) sqlite.close();
    },
  };
}
