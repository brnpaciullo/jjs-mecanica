import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { dispositivos, reposUsuarios } from '@jjs/db';
import { obterBanco } from '../banco.js';
import { log } from '../log.js';

/** O token do QR vale pouco tempo: ele fica exposto na tela do balcão. */
export const VALIDADE_TOKEN_MS = 10 * 60 * 1000;
/** O cookie do celular dura um ano — o mecânico não pode parear toda semana. */
export const VALIDADE_COOKIE_MS = 365 * 24 * 60 * 60 * 1000;
/** Depois de entrar com o PIN, a sessão fica de pé por um turno de trabalho. */
export const VALIDADE_PIN_MS = 12 * 60 * 60 * 1000;

export const COOKIE_DISPOSITIVO = 'jjs_dispositivo';

function hash(valor: string): string {
  return createHash('sha256').update(valor).digest('hex');
}

function iguais(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// ---------------------------------------------------------------- pareamento

interface TokenPendente {
  token: string;
  expiraEm: number;
}

/**
 * O token de pareamento vive só na memória, de propósito: reiniciar o sistema
 * invalida um QR que ficou aberto na tela. É de uso único e expira em 10
 * minutos — quem passar pelo balcão e fotografar a tela depois disso não
 * consegue mais entrar.
 */
let pendente: TokenPendente | null = null;

export function gerarTokenDePareamento(): { token: string; expiraEm: number } {
  const token = randomBytes(32).toString('base64url');
  pendente = { token, expiraEm: Date.now() + VALIDADE_TOKEN_MS };
  log.info('[lan] token de pareamento gerado');
  return { ...pendente };
}

export function descartarTokenDePareamento(): void {
  pendente = null;
}

export interface DispositivoPareado {
  id: number;
  nome: string;
  /** Valor cru do cookie; só existe no momento do pareamento. */
  segredo: string;
}

/**
 * Troca o token do QR por um dispositivo pareado.
 *
 * O token é consumido aqui, dê certo ou não: se alguém tentar reusar um QR já
 * lido, não há segunda chance.
 */
export function parearDispositivo(token: string, nome: string): DispositivoPareado {
  const atual = pendente;
  pendente = null;

  if (!atual) {
    throw new Error('Esse QR code não vale mais. Peça um novo no computador da oficina.');
  }
  if (Date.now() > atual.expiraEm) {
    throw new Error('Esse QR code expirou. Peça um novo no computador da oficina.');
  }
  if (!iguais(token, atual.token)) {
    throw new Error('Esse QR code não confere. Peça um novo no computador da oficina.');
  }

  const segredo = randomBytes(32).toString('base64url');
  const registro = obterBanco()
    .insert(dispositivos)
    .values({
      nome: nome.trim() || 'Celular do mecânico',
      tokenHash: hash(segredo),
      ultimoAcesso: new Date().toISOString(),
    })
    .returning()
    .get();

  log.info(`[lan] dispositivo pareado: ${registro.nome} (id ${registro.id})`);
  return { id: registro.id, nome: registro.nome, segredo };
}

// ------------------------------------------------------------------- sessões

export interface SessaoDoCelular {
  dispositivoId: number;
  nome: string;
  usuarioId: number | null;
  /** Quando o PIN foi conferido; null significa que ainda precisa entrar. */
  pinValidoAte: number | null;
}

/** Sessões de PIN ficam na memória: reiniciar o sistema pede o PIN de novo. */
const sessoes = new Map<number, { usuarioId: number; validoAte: number }>();

/** Confere o cookie e devolve o dispositivo, ou null se não valer. */
export function conferirDispositivo(segredo: string | undefined): SessaoDoCelular | null {
  if (!segredo) return null;

  const registro = obterBanco()
    .select()
    .from(dispositivos)
    .where(and(eq(dispositivos.tokenHash, hash(segredo)), eq(dispositivos.revogado, false)))
    .get();

  if (!registro) return null;

  obterBanco()
    .update(dispositivos)
    .set({ ultimoAcesso: new Date().toISOString() })
    .where(eq(dispositivos.id, registro.id))
    .run();

  const sessao = sessoes.get(registro.id);
  const pinValido = sessao && sessao.validoAte > Date.now() ? sessao : null;

  return {
    dispositivoId: registro.id,
    nome: registro.nome,
    usuarioId: pinValido?.usuarioId ?? null,
    pinValidoAte: pinValido?.validoAte ?? null,
  };
}

export function registrarEntradaComPin(dispositivoId: number, usuarioId: number): void {
  sessoes.set(dispositivoId, { usuarioId, validoAte: Date.now() + VALIDADE_PIN_MS });
  log.info(`[lan] PIN conferido no dispositivo ${dispositivoId} (usuário ${usuarioId})`);
}

export function encerrarSessao(dispositivoId: number): void {
  sessoes.delete(dispositivoId);
}

/** Confere o PIN contra os usuários ativos. Devolve quem entrou, ou null. */
export function conferirPin(pin: string): { id: number; nome: string } | null {
  const db = obterBanco();
  const ctx = { db, usuarioId: null };

  for (const usuario of reposUsuarios.listarUsuarios(ctx)) {
    if (!usuario.ativo || !usuario.pinHash) continue;
    if (reposUsuarios.conferirPin(ctx, usuario.id, pin)) {
      return { id: usuario.id, nome: usuario.nome };
    }
  }
  return null;
}

export function revogarDispositivo(id: number): void {
  obterBanco().update(dispositivos).set({ revogado: true }).where(eq(dispositivos.id, id)).run();
  encerrarSessao(id);
  log.info(`[lan] dispositivo ${id} revogado`);
}

export function listarDispositivos() {
  return obterBanco()
    .select()
    .from(dispositivos)
    .orderBy(dispositivos.criadoEm)
    .all()
    .map((d) => ({
      id: d.id,
      nome: d.nome,
      ultimoAcesso: d.ultimoAcesso,
      revogado: d.revogado,
      // O hash nunca sai daqui.
      temSessaoAberta: sessoes.has(d.id),
    }));
}
