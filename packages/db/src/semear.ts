import { eq, sql } from 'drizzle-orm';
import { oficinaConfig, usuarios } from './schema.js';
import { semearCatalogo } from './seedCatalogo.js';
import type { BancoJjs } from './tipos.js';

/** Modelos de mensagem iniciais. O dono edita em Configuracoes > Textos. */
export const TEMPLATE_ORCAMENTO_PADRAO =
  'Olá {cliente}, tudo bem?\n\n' +
  'Segue o orçamento da {veiculo} placa {placa} (OS {numero_os}).\n' +
  'Valor total: {total}\n\n' +
  'Qualquer dúvida é só chamar aqui. Abraço, JJS Mecânica.';

export const TEMPLATE_PRONTO_PADRAO =
  'Olá {cliente}! A {veiculo} placa {placa} está pronta para retirada.\n\n' +
  'Estamos à disposição no horário de funcionamento. JJS Mecânica.';

export const TEXTO_GARANTIA_PADRAO =
  'Garantia de 90 dias para a mão de obra executada, a contar da data de entrega. ' +
  'Peças seguem a garantia do fabricante.';

/**
 * Deixa o banco utilizavel na primeira execucao: a linha unica de configuracao
 * e o usuario do balcao. O desktop nao pede login, entao esse usuario e quem
 * assina tudo que e feito no notebook.
 */
export function semear(db: BancoJjs): void {
  db.insert(oficinaConfig)
    .values({
      id: 1,
      nome: 'JJS Oficina Mecânica',
      textoGarantia: TEXTO_GARANTIA_PADRAO,
      mensagemRodapePdf: 'Obrigado pela preferência!',
      templateMsgOrcamento: TEMPLATE_ORCAMENTO_PADRAO,
      templateMsgPronto: TEMPLATE_PRONTO_PADRAO,
    })
    .onConflictDoNothing()
    .run();

  const [{ total } = { total: 0 }] = db
    .select({ total: sql<number>`count(*)` })
    .from(usuarios)
    .where(eq(usuarios.papel, 'admin'))
    .all();

  if (total === 0) {
    db.insert(usuarios).values({ nome: 'Balcão', papel: 'admin', ativo: true }).run();
  }

  // Serviços comuns da casa, para o autocompletar da OS já nascer com conteúdo.
  semearCatalogo(db);
}
