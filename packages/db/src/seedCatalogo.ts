import { sql } from 'drizzle-orm';
import type { Categoria, TipoItem } from '@jjs/core';
import { catalogo } from './schema.js';
import type { BancoJjs } from './tipos.js';

interface ItemSeed {
  descricao: string;
  tipo: TipoItem;
  categoria: Categoria;
  /** Valor sugerido em centavos, só para o campo já vir preenchido. */
  valor: number | null;
}

/**
 * Serviços que a JJS mais faz, para o autocompletar da OS já ter conteúdo na
 * primeira abertura. Os valores são chute inicial: quem manda é o dono, que
 * corrige na tela de Catálogo. Peças ficam com valor nulo de propósito —
 * dependem do carro e do fornecedor, e um preço errado fixo é pior que vazio.
 *
 * Câmbio vem mais completo: é a especialidade da casa.
 */
const ITENS: ItemSeed[] = [
  // Câmbio — especialidade
  {
    descricao: 'Revisão de câmbio automático',
    tipo: 'mao_de_obra',
    categoria: 'Câmbio',
    valor: 90000,
  },
  {
    descricao: 'Troca de óleo do câmbio automático',
    tipo: 'mao_de_obra',
    categoria: 'Câmbio',
    valor: 45000,
  },
  {
    descricao: 'Troca de óleo do câmbio manual',
    tipo: 'mao_de_obra',
    categoria: 'Câmbio',
    valor: 18000,
  },
  { descricao: 'Retífica de câmbio', tipo: 'mao_de_obra', categoria: 'Câmbio', valor: 250000 },
  {
    descricao: 'Troca do kit de embreagem',
    tipo: 'mao_de_obra',
    categoria: 'Câmbio',
    valor: 65000,
  },
  {
    descricao: 'Diagnóstico de câmbio (scanner)',
    tipo: 'mao_de_obra',
    categoria: 'Câmbio',
    valor: 15000,
  },
  {
    descricao: 'Troca do filtro do câmbio',
    tipo: 'mao_de_obra',
    categoria: 'Câmbio',
    valor: 22000,
  },
  {
    descricao: 'Reparo do conversor de torque',
    tipo: 'mao_de_obra',
    categoria: 'Câmbio',
    valor: 180000,
  },
  {
    descricao: 'Óleo de câmbio automático (litro)',
    tipo: 'peca',
    categoria: 'Câmbio',
    valor: null,
  },
  { descricao: 'Kit de embreagem', tipo: 'peca', categoria: 'Câmbio', valor: null },
  { descricao: 'Filtro do câmbio', tipo: 'peca', categoria: 'Câmbio', valor: null },

  // Freios
  {
    descricao: 'Troca de pastilhas de freio',
    tipo: 'mao_de_obra',
    categoria: 'Freios',
    valor: 12000,
  },
  { descricao: 'Troca de discos de freio', tipo: 'mao_de_obra', categoria: 'Freios', valor: 18000 },
  { descricao: 'Troca de lonas de freio', tipo: 'mao_de_obra', categoria: 'Freios', valor: 15000 },
  {
    descricao: 'Sangria do sistema de freio',
    tipo: 'mao_de_obra',
    categoria: 'Freios',
    valor: 9000,
  },
  {
    descricao: 'Retífica de disco de freio',
    tipo: 'mao_de_obra',
    categoria: 'Freios',
    valor: 8000,
  },
  { descricao: 'Pastilha de freio (jogo)', tipo: 'peca', categoria: 'Freios', valor: null },
  { descricao: 'Disco de freio (par)', tipo: 'peca', categoria: 'Freios', valor: null },
  { descricao: 'Fluido de freio DOT 4', tipo: 'peca', categoria: 'Freios', valor: null },

  // Suspensão
  {
    descricao: 'Troca de amortecedores (par)',
    tipo: 'mao_de_obra',
    categoria: 'Suspensão',
    valor: 20000,
  },
  { descricao: 'Troca de molas', tipo: 'mao_de_obra', categoria: 'Suspensão', valor: 18000 },
  { descricao: 'Troca de bandeja', tipo: 'mao_de_obra', categoria: 'Suspensão', valor: 16000 },
  { descricao: 'Troca de pivô', tipo: 'mao_de_obra', categoria: 'Suspensão', valor: 12000 },
  {
    descricao: 'Troca de terminal de direção',
    tipo: 'mao_de_obra',
    categoria: 'Suspensão',
    valor: 11000,
  },
  {
    descricao: 'Alinhamento e balanceamento',
    tipo: 'mao_de_obra',
    categoria: 'Suspensão',
    valor: 12000,
  },
  {
    descricao: 'Troca de rolamento de roda',
    tipo: 'mao_de_obra',
    categoria: 'Suspensão',
    valor: 15000,
  },
  { descricao: 'Amortecedor', tipo: 'peca', categoria: 'Suspensão', valor: null },
  { descricao: 'Kit batente e coifa', tipo: 'peca', categoria: 'Suspensão', valor: null },

  // Motor
  { descricao: 'Troca de óleo e filtro', tipo: 'mao_de_obra', categoria: 'Motor', valor: 8000 },
  { descricao: 'Troca da correia dentada', tipo: 'mao_de_obra', categoria: 'Motor', valor: 55000 },
  { descricao: 'Troca de velas', tipo: 'mao_de_obra', categoria: 'Motor', valor: 10000 },
  { descricao: "Troca da bomba d'água", tipo: 'mao_de_obra', categoria: 'Motor', valor: 30000 },
  {
    descricao: 'Troca da junta do cabeçote',
    tipo: 'mao_de_obra',
    categoria: 'Motor',
    valor: 150000,
  },
  { descricao: 'Retífica de motor', tipo: 'mao_de_obra', categoria: 'Motor', valor: 450000 },
  {
    descricao: 'Limpeza de bicos injetores',
    tipo: 'mao_de_obra',
    categoria: 'Motor',
    valor: 25000,
  },
  {
    descricao: 'Troca da correia do alternador',
    tipo: 'mao_de_obra',
    categoria: 'Motor',
    valor: 9000,
  },
  { descricao: 'Óleo de motor (litro)', tipo: 'peca', categoria: 'Motor', valor: null },
  { descricao: 'Filtro de óleo', tipo: 'peca', categoria: 'Motor', valor: null },
  { descricao: 'Filtro de ar', tipo: 'peca', categoria: 'Motor', valor: null },
  { descricao: 'Filtro de combustível', tipo: 'peca', categoria: 'Motor', valor: null },
  { descricao: 'Vela de ignição (jogo)', tipo: 'peca', categoria: 'Motor', valor: null },
  { descricao: 'Kit correia dentada', tipo: 'peca', categoria: 'Motor', valor: null },

  // Elétrica
  { descricao: 'Troca de bateria', tipo: 'mao_de_obra', categoria: 'Elétrica', valor: 5000 },
  { descricao: 'Reparo do alternador', tipo: 'mao_de_obra', categoria: 'Elétrica', valor: 35000 },
  {
    descricao: 'Reparo do motor de partida',
    tipo: 'mao_de_obra',
    categoria: 'Elétrica',
    valor: 32000,
  },
  {
    descricao: 'Diagnóstico elétrico (scanner)',
    tipo: 'mao_de_obra',
    categoria: 'Elétrica',
    valor: 15000,
  },
  { descricao: 'Troca de lâmpadas', tipo: 'mao_de_obra', categoria: 'Elétrica', valor: 4000 },
  {
    descricao: 'Revisão do chicote elétrico',
    tipo: 'mao_de_obra',
    categoria: 'Elétrica',
    valor: 20000,
  },
  { descricao: 'Bateria', tipo: 'peca', categoria: 'Elétrica', valor: null },

  // Ar-condicionado
  {
    descricao: 'Recarga de gás do ar-condicionado',
    tipo: 'mao_de_obra',
    categoria: 'Ar-condicionado',
    valor: 25000,
  },
  {
    descricao: 'Higienização do ar-condicionado',
    tipo: 'mao_de_obra',
    categoria: 'Ar-condicionado',
    valor: 15000,
  },
  {
    descricao: 'Troca do filtro de cabine',
    tipo: 'mao_de_obra',
    categoria: 'Ar-condicionado',
    valor: 6000,
  },
  {
    descricao: 'Troca do compressor do ar',
    tipo: 'mao_de_obra',
    categoria: 'Ar-condicionado',
    valor: 45000,
  },
  {
    descricao: 'Busca de vazamento no ar',
    tipo: 'mao_de_obra',
    categoria: 'Ar-condicionado',
    valor: 18000,
  },
  { descricao: 'Filtro de cabine', tipo: 'peca', categoria: 'Ar-condicionado', valor: null },

  // Mecânica em geral
  { descricao: 'Revisão geral', tipo: 'mao_de_obra', categoria: 'Mecânica em geral', valor: 35000 },
  {
    descricao: 'Diagnóstico / avaliação',
    tipo: 'mao_de_obra',
    categoria: 'Mecânica em geral',
    valor: 10000,
  },
  {
    descricao: 'Troca do fluido de arrefecimento',
    tipo: 'mao_de_obra',
    categoria: 'Mecânica em geral',
    valor: 12000,
  },
  {
    descricao: 'Troca do escapamento',
    tipo: 'mao_de_obra',
    categoria: 'Mecânica em geral',
    valor: 20000,
  },
  {
    descricao: 'Hora de mão de obra',
    tipo: 'mao_de_obra',
    categoria: 'Mecânica em geral',
    valor: 14000,
  },
  { descricao: 'Aditivo de radiador', tipo: 'peca', categoria: 'Mecânica em geral', valor: null },
];

/**
 * Só popula quando o catálogo está vazio. Nunca sobrescreve: o dono pode ter
 * apagado um item de propósito, e uma atualização do sistema não pode trazer
 * de volta nem desfazer os preços que ele ajustou.
 */
export function semearCatalogo(db: BancoJjs): number {
  const [{ total } = { total: 0 }] = db
    .select({ total: sql<number>`count(*)` })
    .from(catalogo)
    .all();

  if (total > 0) return 0;

  db.insert(catalogo)
    .values(
      ITENS.map((item) => ({
        descricao: item.descricao,
        tipo: item.tipo,
        categoria: item.categoria,
        valorPadraoCentavos: item.valor,
      })),
    )
    .run();

  return ITENS.length;
}
