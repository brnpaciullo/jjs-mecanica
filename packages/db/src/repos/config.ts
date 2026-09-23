import { eq } from 'drizzle-orm';
import { oficinaConfig, usuarios } from '../schema.js';
import { ErroDeNegocio, type Contexto } from './contexto.js';

export type ConfigRegistro = typeof oficinaConfig.$inferSelect;
export type UsuarioRegistro = typeof usuarios.$inferSelect;

export function lerConfig(ctx: Contexto): ConfigRegistro {
  const config = ctx.db.select().from(oficinaConfig).where(eq(oficinaConfig.id, 1)).get();
  if (!config) throw new ErroDeNegocio('As configurações da oficina não foram encontradas.');
  return config;
}

/** Campos que a tela de Configurações pode alterar. */
export type ConfigEditavel = Partial<
  Pick<
    ConfigRegistro,
    | 'nome'
    | 'cnpj'
    | 'endereco'
    | 'telefone'
    | 'logoPath'
    | 'textoGarantia'
    | 'validadeOrcamentoDias'
    | 'mensagemRodapePdf'
    | 'impressoraPadrao'
    | 'pastaBackup'
    | 'economizarTinta'
    | 'templateMsgOrcamento'
    | 'templateMsgPronto'
  >
>;

export function salvarConfig(ctx: Contexto, entrada: ConfigEditavel): ConfigRegistro {
  const atual = lerConfig(ctx);
  const dias = entrada.validadeOrcamentoDias ?? atual.validadeOrcamentoDias;
  if (dias < 1 || dias > 365) {
    throw new ErroDeNegocio('A validade do orçamento precisa ficar entre 1 e 365 dias.');
  }

  return ctx.db
    .update(oficinaConfig)
    .set({ ...entrada, atualizadoEm: new Date().toISOString() })
    .where(eq(oficinaConfig.id, 1))
    .returning()
    .get();
}

/**
 * Preenche as variáveis dos modelos de mensagem do WhatsApp.
 * Usado na etapa 5 e já na pré-visualização da tela de Configurações.
 */
export function aplicarVariaveis(
  modelo: string,
  variaveis: Record<'cliente' | 'veiculo' | 'placa' | 'numero_os' | 'total', string>,
): string {
  return (modelo ?? '').replace(/\{(\w+)\}/g, (original, chave: string) =>
    chave in variaveis ? variaveis[chave as keyof typeof variaveis] : original,
  );
}

export function listarUsuarios(ctx: Contexto): UsuarioRegistro[] {
  return ctx.db.select().from(usuarios).orderBy(usuarios.nome).all();
}

export function usuarioPadrao(ctx: Contexto): UsuarioRegistro | null {
  return (
    ctx.db.select().from(usuarios).where(eq(usuarios.papel, 'admin')).orderBy(usuarios.id).get() ??
    null
  );
}
