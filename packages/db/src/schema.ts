import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type {
  Categoria,
  ChecklistEntrada,
  Combustivel,
  MomentoMidia,
  Papel,
  StatusOrdem,
  TipoItem,
} from '@jjs/core';

/**
 * Convencoes do banco:
 * - dinheiro sempre em centavos, inteiro. Nunca float.
 * - data e hora sempre em texto ISO 8601.
 * - placa normalizada (maiuscula, sem hifen); telefone em E.164.
 * - nada e excluido: existe a coluna `arquivado`.
 * - nomes de tabela e coluna em portugues, iguais aos do dominio.
 */

const agora = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

/** Linha unica: id sempre 1. */
export const oficinaConfig = sqliteTable('oficina_config', {
  id: integer('id').primaryKey().default(1),
  nome: text('nome').notNull().default('JJS Oficina Mecânica'),
  cnpj: text('cnpj'),
  endereco: text('endereco'),
  telefone: text('telefone'),
  logoPath: text('logo_path'),
  textoGarantia: text('texto_garantia'),
  validadeOrcamentoDias: integer('validade_orcamento_dias').notNull().default(7),
  mensagemRodapePdf: text('mensagem_rodape_pdf'),
  impressoraPadrao: text('impressora_padrao'),
  pastaBackup: text('pasta_backup'),
  economizarTinta: integer('economizar_tinta', { mode: 'boolean' }).notNull().default(true),
  templateMsgOrcamento: text('template_msg_orcamento'),
  templateMsgPronto: text('template_msg_pronto'),
  atualizadoEm: text('atualizado_em').notNull().default(agora),
});

export const usuarios = sqliteTable('usuarios', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nome: text('nome').notNull(),
  papel: text('papel').$type<Papel>().notNull().default('balcao'),
  pinHash: text('pin_hash'),
  ativo: integer('ativo', { mode: 'boolean' }).notNull().default(true),
  criadoEm: text('criado_em').notNull().default(agora),
});

export const clientes = sqliteTable(
  'clientes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    nome: text('nome').notNull(),
    telefone: text('telefone').notNull(),
    cpf: text('cpf'),
    endereco: text('endereco'),
    observacoes: text('observacoes'),
    arquivado: integer('arquivado', { mode: 'boolean' }).notNull().default(false),
    criadoEm: text('criado_em').notNull().default(agora),
  },
  (t) => [index('idx_clientes_nome').on(t.nome), index('idx_clientes_telefone').on(t.telefone)],
);

export const veiculos = sqliteTable(
  'veiculos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    clienteId: integer('cliente_id')
      .notNull()
      .references(() => clientes.id),
    marca: text('marca').notNull(),
    modelo: text('modelo').notNull(),
    ano: integer('ano'),
    placa: text('placa').notNull(),
    cor: text('cor'),
    kmAtual: integer('km_atual'),
    observacoes: text('observacoes'),
    arquivado: integer('arquivado', { mode: 'boolean' }).notNull().default(false),
    criadoEm: text('criado_em').notNull().default(agora),
  },
  (t) => [index('idx_veiculos_placa').on(t.placa), index('idx_veiculos_cliente').on(t.clienteId)],
);

export const ordens = sqliteTable(
  'ordens',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    /** Sequencial visivel, comeca em 1 e aparece como "OS 0001". */
    numero: integer('numero').notNull(),
    clienteId: integer('cliente_id')
      .notNull()
      .references(() => clientes.id),
    veiculoId: integer('veiculo_id')
      .notNull()
      .references(() => veiculos.id),
    status: text('status').$type<StatusOrdem>().notNull().default('recepcao'),
    kmEntrada: integer('km_entrada'),
    combustivel: text('combustivel').$type<Combustivel>(),
    checklistEntrada: text('checklist_entrada', { mode: 'json' }).$type<ChecklistEntrada>(),
    /** O que o cliente relatou. */
    queixas: text('queixas').notNull(),
    /** O que a oficina constatou. */
    diagnostico: text('diagnostico'),
    descontoCentavos: integer('desconto_centavos').notNull().default(0),
    prazoEstimado: text('prazo_estimado'),
    validadeAte: text('validade_ate'),
    formaPagamento: text('forma_pagamento'),
    pago: integer('pago', { mode: 'boolean' }).notNull().default(false),
    observacoesGerais: text('observacoes_gerais'),

    // Um carimbo por status. A linha do tempo completa fica em ordem_eventos;
    // estas colunas existem para ordenar o quadro e medir tempo de etapa sem
    // precisar varrer os eventos.
    recepcaoEm: text('recepcao_em'),
    diagnosticoEm: text('diagnostico_em'),
    orcamentoEnviadoEm: text('orcamento_enviado_em'),
    aprovadoEm: text('aprovado_em'),
    recusadoEm: text('recusado_em'),
    emServicoEm: text('em_servico_em'),
    prontoEm: text('pronto_em'),
    entregueEm: text('entregue_em'),

    criadoPor: integer('criado_por').references(() => usuarios.id),
    criadoEm: text('criado_em').notNull().default(agora),
    atualizadoEm: text('atualizado_em').notNull().default(agora),
  },
  (t) => [
    uniqueIndex('idx_ordens_numero').on(t.numero),
    index('idx_ordens_status').on(t.status),
    index('idx_ordens_veiculo').on(t.veiculoId),
    index('idx_ordens_cliente').on(t.clienteId),
  ],
);

export const itensOrdem = sqliteTable(
  'itens_ordem',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    ordemId: integer('ordem_id')
      .notNull()
      .references(() => ordens.id),
    tipo: text('tipo').$type<TipoItem>().notNull(),
    descricao: text('descricao').notNull(),
    /** Real porque existe "1,5 hora" de mao de obra e "0,5 litro" de oleo. */
    quantidade: real('quantidade').notNull().default(1),
    valorUnitarioCentavos: integer('valor_unitario_centavos').notNull().default(0),
    observacao: text('observacao'),
    /** Aprovacao parcial: o total da OS soma so os itens aprovados. */
    aprovado: integer('aprovado', { mode: 'boolean' }).notNull().default(true),
    posicao: integer('posicao').notNull().default(0),
    criadoPor: integer('criado_por').references(() => usuarios.id),
    criadoEm: text('criado_em').notNull().default(agora),
  },
  (t) => [index('idx_itens_ordem').on(t.ordemId, t.posicao)],
);

export const midias = sqliteTable(
  'midias',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    /** Nulo = caixa "Midias sem OS". */
    ordemId: integer('ordem_id').references(() => ordens.id),
    itemId: integer('item_id').references(() => itensOrdem.id),
    tipo: text('tipo').$type<'foto' | 'video'>().notNull(),
    /** Caminho relativo a pasta de midias, para o backup poder mudar de lugar. */
    arquivoPath: text('arquivo_path').notNull(),
    thumbPath: text('thumb_path'),
    tamanhoBytes: integer('tamanho_bytes'),
    duracaoS: real('duracao_s'),
    momento: text('momento').$type<MomentoMidia>().notNull().default('servico'),
    incluirParaCliente: integer('incluir_para_cliente', { mode: 'boolean' })
      .notNull()
      .default(false),
    origem: text('origem').$type<'app' | 'whatsapp'>().notNull().default('app'),
    statusProcessamento: text('status_processamento')
      .$type<'pendente' | 'pronto' | 'erro'>()
      .notNull()
      .default('pronto'),
    legenda: text('legenda'),
    criadoPor: integer('criado_por').references(() => usuarios.id),
    criadoEm: text('criado_em').notNull().default(agora),
  },
  (t) => [
    index('idx_midias_ordem').on(t.ordemId),
    index('idx_midias_status').on(t.statusProcessamento),
  ],
);

export const catalogo = sqliteTable(
  'catalogo',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    descricao: text('descricao').notNull(),
    tipo: text('tipo').$type<TipoItem>().notNull(),
    valorPadraoCentavos: integer('valor_padrao_centavos'),
    categoria: text('categoria').$type<Categoria>(),
    ativo: integer('ativo', { mode: 'boolean' }).notNull().default(true),
    criadoEm: text('criado_em').notNull().default(agora),
  },
  (t) => [
    index('idx_catalogo_descricao').on(t.descricao),
    index('idx_catalogo_categoria').on(t.categoria),
  ],
);

export const mensagens = sqliteTable(
  'mensagens',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    ordemId: integer('ordem_id').references(() => ordens.id),
    clienteId: integer('cliente_id').references(() => clientes.id),
    tipo: text('tipo').$type<'orcamento' | 'pronto' | 'avulsa'>().notNull(),
    conteudo: text('conteudo').notNull(),
    anexos: text('anexos', { mode: 'json' }).$type<string[]>(),
    status: text('status').$type<'enviada' | 'falhou' | 'fallback_link'>().notNull(),
    erro: text('erro'),
    enviadoEm: text('enviado_em').notNull().default(agora),
  },
  (t) => [index('idx_mensagens_ordem').on(t.ordemId)],
);

/** Celulares pareados pelo QR code. */
export const dispositivos = sqliteTable('dispositivos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nome: text('nome').notNull(),
  tokenHash: text('token_hash').notNull(),
  usuarioId: integer('usuario_id').references(() => usuarios.id),
  ultimoAcesso: text('ultimo_acesso'),
  revogado: integer('revogado', { mode: 'boolean' }).notNull().default(false),
  criadoEm: text('criado_em').notNull().default(agora),
});

/** Linha do tempo da OS: status, mensagens enviadas e quem fez o que. */
export const ordemEventos = sqliteTable(
  'ordem_eventos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    ordemId: integer('ordem_id')
      .notNull()
      .references(() => ordens.id),
    tipo: text('tipo').$type<'status' | 'mensagem' | 'midia' | 'item' | 'nota'>().notNull(),
    /** Texto ja pronto para a tela, em linguagem de oficina. */
    descricao: text('descricao').notNull(),
    statusDe: text('status_de').$type<StatusOrdem>(),
    statusPara: text('status_para').$type<StatusOrdem>(),
    usuarioId: integer('usuario_id').references(() => usuarios.id),
    criadoEm: text('criado_em').notNull().default(agora),
  },
  (t) => [index('idx_eventos_ordem').on(t.ordemId, t.criadoEm)],
);

export const schema = {
  oficinaConfig,
  usuarios,
  clientes,
  veiculos,
  ordens,
  itensOrdem,
  midias,
  catalogo,
  mensagens,
  dispositivos,
  ordemEventos,
};
