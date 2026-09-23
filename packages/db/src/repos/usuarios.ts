import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { usuarioSchema, type NovoUsuario, type Papel } from '@jjs/core';
import { usuarios } from '../schema.js';
import { ErroDeNegocio, validar, type Contexto } from './contexto.js';

export type UsuarioRegistro = typeof usuarios.$inferSelect;

/**
 * PIN guardado com scrypt e sal próprio — nunca em texto puro, nem com um
 * hash rápido tipo SHA. Um PIN de 4 dígitos é curto por natureza; o que
 * protege de verdade é o limite de tentativas na API do celular (etapa 6).
 * Usa o `node:crypto`, sem dependência extra.
 */
function gerarHash(pin: string): string {
  const sal = randomBytes(16);
  const derivado = scryptSync(pin, sal, 32);
  return `scrypt$${sal.toString('hex')}$${derivado.toString('hex')}`;
}

function conferirHash(pin: string, hash: string | null): boolean {
  if (!hash) return false;
  const [algoritmo, salHex, esperadoHex] = hash.split('$');
  if (algoritmo !== 'scrypt' || !salHex || !esperadoHex) return false;

  const esperado = Buffer.from(esperadoHex, 'hex');
  const derivado = scryptSync(pin, Buffer.from(salHex, 'hex'), esperado.length);
  // Comparação em tempo constante: não entrega o PIN pelo tempo de resposta.
  return timingSafeEqual(derivado, esperado);
}

export function listarUsuarios(ctx: Contexto): UsuarioRegistro[] {
  return ctx.db.select().from(usuarios).orderBy(usuarios.nome).all();
}

export function criarUsuario(ctx: Contexto, entrada: NovoUsuario): UsuarioRegistro {
  const dados = validar(usuarioSchema, entrada);
  return ctx.db
    .insert(usuarios)
    .values({
      nome: dados.nome,
      papel: dados.papel,
      pinHash: dados.pin ? gerarHash(dados.pin) : null,
    })
    .returning()
    .get();
}

export function atualizarUsuario(
  ctx: Contexto,
  id: number,
  entrada: { nome?: string; papel?: Papel; pin?: string | null; ativo?: boolean },
): UsuarioRegistro {
  const atual = ctx.db.select().from(usuarios).where(eq(usuarios.id, id)).get();
  if (!atual) throw new ErroDeNegocio('Esse usuário não foi encontrado.');

  const mudancas: Partial<typeof usuarios.$inferInsert> = {};
  if (entrada.nome !== undefined) mudancas.nome = entrada.nome.trim();
  if (entrada.papel !== undefined) mudancas.papel = entrada.papel;
  if (entrada.ativo !== undefined) mudancas.ativo = entrada.ativo;

  // pin === null apaga o PIN; undefined deixa como está.
  if (entrada.pin !== undefined) {
    if (entrada.pin === null || entrada.pin === '') {
      mudancas.pinHash = null;
    } else {
      if (!/^\d{4,6}$/.test(entrada.pin)) {
        throw new ErroDeNegocio('O PIN precisa ter de 4 a 6 números.');
      }
      mudancas.pinHash = gerarHash(entrada.pin);
    }
  }

  if (mudancas.nome === '') throw new ErroDeNegocio('Preencha o nome do usuário.');

  return ctx.db.update(usuarios).set(mudancas).where(eq(usuarios.id, id)).returning().get();
}

/** Usado pelo login do celular na etapa 6. */
export function conferirPin(ctx: Contexto, usuarioId: number, pin: string): boolean {
  const usuario = ctx.db.select().from(usuarios).where(eq(usuarios.id, usuarioId)).get();
  if (!usuario || !usuario.ativo) return false;
  return conferirHash(pin, usuario.pinHash);
}

export function temPin(ctx: Contexto, usuarioId: number): boolean {
  const usuario = ctx.db.select().from(usuarios).where(eq(usuarios.id, usuarioId)).get();
  return Boolean(usuario?.pinHash);
}
