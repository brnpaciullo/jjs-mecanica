import type { z } from 'zod';
import type { BancoJjs } from '../tipos.js';

/**
 * O que todo repositório precisa saber. `usuarioId` vira a autoria em
 * `criado_por` e na linha do tempo — no balcão é sempre o usuário do notebook,
 * no celular (etapa 6) será o mecânico que entrou com o PIN.
 */
export interface Contexto {
  db: BancoJjs;
  usuarioId: number | null;
}

/** Erro previsto, com mensagem que a tela pode mostrar direto ao usuário. */
export class ErroDeNegocio extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeNegocio';
  }
}

/**
 * Valida uma entrada e, se falhar, levanta um ErroDeNegocio com a primeira
 * mensagem em português.
 *
 * Nunca chamar `schema.parse` direto num repositório: o ZodError traz como
 * `.message` um dump JSON das falhas, e esse texto chegaria cru na tela da
 * oficina. As mensagens úteis estão dentro de `issues` — é de lá que a frase
 * sai.
 */
export function validar<E extends z.ZodTypeAny>(esquema: E, entrada: unknown): z.output<E> {
  const analise = esquema.safeParse(entrada);
  if (analise.success) return analise.data;

  const primeira = analise.error.issues[0];
  throw new ErroDeNegocio(primeira?.message ?? 'Confira os dados preenchidos.');
}
