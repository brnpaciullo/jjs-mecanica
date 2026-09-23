import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { schema } from './schema.js';

export type BancoJjs = BetterSQLite3Database<typeof schema>;

/** Assinatura minima que o electron-log ja atende, sem acoplar o db ao Electron. */
export interface Registrador {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export const registradorSilencioso: Registrador = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

export interface OpcoesBanco {
  /** Caminho do jjs.db. */
  arquivoDb: string;
  /** Onde cai o backup feito antes de migrar. */
  pastaBackups: string;
  /** Pasta com o SQL gerado pelo drizzle-kit. */
  pastaMigrations: string;
  registrador?: Registrador;
}
