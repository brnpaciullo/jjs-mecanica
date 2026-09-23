import { app, dialog } from 'electron';
import { z } from 'zod';
import {
  reposBusca,
  reposCatalogo,
  reposClientes,
  reposConfig,
  reposEventos,
  reposItens,
  reposOrdens,
  reposUsuarios,
  reposVeiculos,
  type Contexto,
} from '@jjs/db';
import { CATEGORIAS, PAPEIS, STATUS_ORDEM, TIPOS_ITEM, COMBUSTIVEL } from '@jjs/core';
import { obterBanco, obterUsuarioPadrao } from '../banco.js';
import { gerarPdf, imprimir, listarImpressoras } from '../pdf.js';
import { escolherLogo, removerLogo } from '../logo.js';
import { abrirPasta, revelarArquivo } from '../platform/index.js';
import {
  desconectarWhatsApp,
  exigirSocket,
  iniciarWhatsApp,
  lerEstadoWhatsApp,
  observarWhatsApp,
} from '../whatsapp/conexao.js';
import {
  avisarPronto,
  enviarComprovanteEntrada,
  enviarMidiasDaOrdem,
  enviarOrcamento,
  enviarTeste,
} from '../whatsapp/envio.js';
import { listarGrupos } from '../whatsapp/grupos.js';
import { obterJanela } from '../janela.js';
import { fazerBackup, listarBackups } from '../backup/fazer.js';
import { lerIndice } from '../backup/indice.js';
import {
  escolherBackup,
  inspecionarBackup,
  reiniciarApp,
  restaurarBackup,
} from '../backup/restaurar.js';
import { aplicarAtualizacao, lerEstadoAtualizacao, procurarAtualizacao } from '../atualizacao.js';
import { exportarDiagnostico } from '../diagnostico.js';
import { lerEstadoDoServidor } from '../lan/servidor.js';
import {
  descartarTokenDePareamento,
  gerarTokenDePareamento,
  listarDispositivos,
  revogarDispositivo,
} from '../lan/sessao.js';
import { liberarPortaNoFirewall, regraDeFirewallExiste } from '../platform/index.js';
import {
  anexarMidiaAOrdem,
  definirEnvioAoCliente,
  listarMidias,
  listarMidiasSemOs,
} from '../midias/consultar.js';
import QRCode from 'qrcode';
import type { CaminhosApp } from '../caminhos.js';
import { EH_WINDOWS } from '../platform/index.js';
import { registrarCanal, semEntrada } from './registrar.js';

/**
 * Cada canal só monta o contexto e chama o repositório. Nenhuma regra de
 * negócio mora aqui de propósito: na etapa 6 a API REST do celular vai chamar
 * exatamente as mesmas funções, e as duas precisam se comportar igual.
 */
function ctx(): Contexto {
  return { db: obterBanco(), usuarioId: obterUsuarioPadrao() };
}

const id = z.object({ id: z.number().int().positive() });
const termoOpcional = z.object({ termo: z.string().default('') }).default({ termo: '' });

const clienteEntrada = z.object({
  nome: z.string(),
  telefone: z.string(),
  cpf: z.string().nullable().optional(),
  endereco: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
});

const veiculoEntrada = z.object({
  clienteId: z.number().int().positive(),
  marca: z.string(),
  modelo: z.string(),
  placa: z.string(),
  ano: z.number().int().nullable().optional(),
  cor: z.string().nullable().optional(),
  kmAtual: z.number().int().nullable().optional(),
  observacoes: z.string().nullable().optional(),
});

const itemEntrada = z.object({
  tipo: z.enum(TIPOS_ITEM),
  descricao: z.string(),
  quantidade: z.number().positive().default(1),
  valorUnitarioCentavos: z.number().int().min(0),
  observacao: z.string().nullable().optional(),
  aprovado: z.boolean().default(true),
});

export interface InfoApp {
  versao: string;
  plataforma: NodeJS.Platform;
  ehWindows: boolean;
  empacotado: boolean;
  pastaDados: string;
}

export function registrarCanais(caminhos: CaminhosApp): void {
  // ---------- app ----------
  registrarCanal('app:info', semEntrada, (): InfoApp => ({
    versao: app.getVersion(),
    plataforma: process.platform,
    ehWindows: EH_WINDOWS,
    empacotado: app.isPackaged,
    pastaDados: caminhos.userData,
  }));

  registrarCanal('app:caminhos', semEntrada, (): CaminhosApp => caminhos);

  // ---------- configurações da oficina ----------
  registrarCanal('config:ler', semEntrada, () => reposConfig.lerConfig(ctx()));

  registrarCanal(
    'config:salvar',
    z.object({
      nome: z.string().optional(),
      cnpj: z.string().nullable().optional(),
      endereco: z.string().nullable().optional(),
      telefone: z.string().nullable().optional(),
      textoGarantia: z.string().nullable().optional(),
      validadeOrcamentoDias: z.number().int().optional(),
      mensagemRodapePdf: z.string().nullable().optional(),
      economizarTinta: z.boolean().optional(),
      templateMsgOrcamento: z.string().nullable().optional(),
      templateMsgPronto: z.string().nullable().optional(),
      templateMsgRecebimento: z.string().nullable().optional(),
    }),
    (entrada) => reposConfig.salvarConfig(ctx(), entrada),
  );

  // ---------- usuários ----------
  registrarCanal('usuarios:listar', semEntrada, () => reposUsuarios.listarUsuarios(ctx()));

  registrarCanal(
    'usuarios:criar',
    z.object({
      nome: z.string(),
      papel: z.enum(PAPEIS),
      pin: z.string().nullable().optional(),
    }),
    (entrada) => reposUsuarios.criarUsuario(ctx(), entrada),
  );

  registrarCanal(
    'usuarios:atualizar',
    z.object({
      id: z.number().int().positive(),
      nome: z.string().optional(),
      papel: z.enum(PAPEIS).optional(),
      pin: z.string().nullable().optional(),
      ativo: z.boolean().optional(),
    }),
    ({ id: usuarioId, ...resto }) => reposUsuarios.atualizarUsuario(ctx(), usuarioId, resto),
  );

  // ---------- clientes ----------
  registrarCanal('clientes:listar', termoOpcional, ({ termo }) =>
    reposClientes.listarClientes(ctx(), termo),
  );
  registrarCanal('clientes:buscar', id, ({ id: clienteId }) =>
    reposClientes.buscarCliente(ctx(), clienteId),
  );
  registrarCanal('clientes:criar', clienteEntrada, (entrada) =>
    reposClientes.criarCliente(ctx(), entrada),
  );
  registrarCanal(
    'clientes:atualizar',
    clienteEntrada.partial().extend({ id: z.number().int().positive() }),
    ({ id: clienteId, ...resto }) => reposClientes.atualizarCliente(ctx(), clienteId, resto),
  );
  registrarCanal(
    'clientes:arquivar',
    z.object({ id: z.number().int().positive(), arquivado: z.boolean().default(true) }),
    ({ id: clienteId, arquivado }) => reposClientes.arquivarCliente(ctx(), clienteId, arquivado),
  );

  // ---------- veículos ----------
  registrarCanal('veiculos:listar', termoOpcional, ({ termo }) =>
    reposVeiculos.listarVeiculos(ctx(), termo),
  );
  registrarCanal('veiculos:buscar', id, ({ id: veiculoId }) =>
    reposVeiculos.buscarVeiculo(ctx(), veiculoId),
  );
  registrarCanal(
    'veiculos:doCliente',
    z.object({ clienteId: z.number().int().positive() }),
    ({ clienteId }) => reposVeiculos.veiculosDoCliente(ctx(), clienteId),
  );
  registrarCanal('veiculos:porPlaca', z.object({ placa: z.string() }), ({ placa }) =>
    reposVeiculos.acharPorPlaca(ctx(), placa),
  );
  registrarCanal('veiculos:criar', veiculoEntrada, (entrada) =>
    reposVeiculos.criarVeiculo(ctx(), entrada),
  );
  registrarCanal(
    'veiculos:atualizar',
    veiculoEntrada.partial().extend({ id: z.number().int().positive() }),
    ({ id: veiculoId, ...resto }) => reposVeiculos.atualizarVeiculo(ctx(), veiculoId, resto),
  );
  registrarCanal(
    'veiculos:arquivar',
    z.object({ id: z.number().int().positive(), arquivado: z.boolean().default(true) }),
    ({ id: veiculoId, arquivado }) => reposVeiculos.arquivarVeiculo(ctx(), veiculoId, arquivado),
  );

  // ---------- catálogo ----------
  registrarCanal('catalogo:listar', termoOpcional, ({ termo }) =>
    reposCatalogo.listarCatalogo(ctx(), termo),
  );
  registrarCanal('catalogo:sugerir', z.object({ termo: z.string() }), ({ termo }) =>
    reposCatalogo.sugerirCatalogo(ctx(), termo),
  );
  registrarCanal(
    'catalogo:criar',
    z.object({
      descricao: z.string(),
      tipo: z.enum(TIPOS_ITEM),
      valorPadraoCentavos: z.number().int().nullable().optional(),
      categoria: z.enum(CATEGORIAS).nullable().optional(),
    }),
    (entrada) => reposCatalogo.criarItemCatalogo(ctx(), entrada),
  );
  registrarCanal(
    'catalogo:atualizar',
    z.object({
      id: z.number().int().positive(),
      descricao: z.string().optional(),
      tipo: z.enum(TIPOS_ITEM).optional(),
      valorPadraoCentavos: z.number().int().nullable().optional(),
      categoria: z.enum(CATEGORIAS).nullable().optional(),
    }),
    ({ id: itemId, ...resto }) => reposCatalogo.atualizarItemCatalogo(ctx(), itemId, resto),
  );
  registrarCanal(
    'catalogo:arquivar',
    z.object({ id: z.number().int().positive(), ativo: z.boolean().default(false) }),
    ({ id: itemId, ativo }) => reposCatalogo.arquivarItemCatalogo(ctx(), itemId, ativo),
  );

  // ---------- ordens ----------
  registrarCanal('ordens:quadro', semEntrada, () => reposOrdens.listarQuadro(ctx()));

  registrarCanal(
    'ordens:historico',
    z
      .object({
        termo: z.string().optional(),
        status: z.enum(STATUS_ORDEM).nullable().optional(),
        de: z.string().nullable().optional(),
        ate: z.string().nullable().optional(),
      })
      .default({}),
    (filtro) => reposOrdens.listarHistorico(ctx(), filtro),
  );

  registrarCanal(
    'ordens:criar',
    z.object({
      clienteId: z.number().int().positive(),
      veiculoId: z.number().int().positive(),
      queixas: z.string(),
      kmEntrada: z.number().int().nullable().optional(),
      combustivel: z.enum(COMBUSTIVEL).nullable().optional(),
      checklistEntrada: z
        .object({
          avarias: z.array(z.string()).default([]),
          objetos: z.array(z.string()).default([]),
          observacoes: z.string().default(''),
        })
        .nullable()
        .optional(),
    }),
    (entrada) => reposOrdens.criarOrdem(ctx(), entrada),
  );

  /** Tudo que a tela da OS precisa, numa chamada só. */
  registrarCanal('ordens:abrir', id, ({ id: ordemId }) => {
    const contexto = ctx();
    const ordem = reposOrdens.buscarOrdem(contexto, ordemId);
    if (!ordem) return null;

    return {
      ordem,
      detalhe: reposOrdens.detalharOrdem(contexto, ordemId),
      itens: reposItens.listarItens(contexto, ordemId),
      totais: reposItens.totaisDaOrdem(contexto, ordemId),
      eventos: reposEventos.listarEventos(contexto, ordemId),
    };
  });

  registrarCanal(
    'ordens:atualizar',
    z.object({
      id: z.number().int().positive(),
      queixas: z.string().optional(),
      diagnostico: z.string().nullable().optional(),
      descontoCentavos: z.number().int().optional(),
      prazoEstimado: z.string().nullable().optional(),
      formaPagamento: z.string().nullable().optional(),
      observacoesGerais: z.string().nullable().optional(),
      kmEntrada: z.number().int().nullable().optional(),
      combustivel: z.enum(COMBUSTIVEL).nullable().optional(),
      pago: z.boolean().optional(),
    }),
    ({ id: ordemId, ...resto }) => reposOrdens.atualizarOrdem(ctx(), ordemId, resto),
  );

  registrarCanal(
    'ordens:mudarStatus',
    z.object({
      id: z.number().int().positive(),
      status: z.enum(STATUS_ORDEM),
      kmSaida: z.number().int().nullable().optional(),
      formaPagamento: z.string().nullable().optional(),
    }),
    ({ id: ordemId, status, kmSaida, formaPagamento }) =>
      reposOrdens.mudarStatus(ctx(), ordemId, status, { kmSaida, formaPagamento }),
  );

  registrarCanal(
    'ordens:doVeiculo',
    z.object({ veiculoId: z.number().int().positive() }),
    ({ veiculoId }) => reposOrdens.ordensDoVeiculo(ctx(), veiculoId),
  );
  registrarCanal(
    'ordens:doCliente',
    z.object({ clienteId: z.number().int().positive() }),
    ({ clienteId }) => reposOrdens.ordensDoCliente(ctx(), clienteId),
  );

  // ---------- itens da OS ----------
  registrarCanal(
    'itens:adicionar',
    itemEntrada.extend({ ordemId: z.number().int().positive() }),
    ({ ordemId, ...resto }) => reposItens.adicionarItem(ctx(), ordemId, resto),
  );

  registrarCanal(
    'itens:atualizar',
    itemEntrada.partial().extend({ id: z.number().int().positive() }),
    ({ id: itemId, ...resto }) => reposItens.atualizarItem(ctx(), itemId, resto),
  );

  registrarCanal('itens:remover', id, ({ id: itemId }) => {
    reposItens.removerItem(ctx(), itemId);
    return { removido: true };
  });

  registrarCanal(
    'itens:reordenar',
    z.object({ ordemId: z.number().int().positive(), ids: z.array(z.number().int().positive()) }),
    ({ ordemId, ids }) => {
      reposItens.reordenarItens(ctx(), ordemId, ids);
      return reposItens.listarItens(ctx(), ordemId);
    },
  );

  registrarCanal(
    'itens:aprovarTodos',
    z.object({ ordemId: z.number().int().positive(), aprovado: z.boolean() }),
    ({ ordemId, aprovado }) => reposItens.definirAprovacaoDeTodos(ctx(), ordemId, aprovado),
  );

  // ---------- logo da oficina ----------
  registrarCanal('logo:escolher', semEntrada, () => escolherLogo(caminhos));
  registrarCanal('logo:remover', semEntrada, () => {
    removerLogo(caminhos);
    return { removido: true };
  });

  // ---------- PDF e impressão ----------
  const opcoesPdf = z.object({
    id: z.number().int().positive(),
    variacao: z.enum(['orcamento', 'ordem_servico']).optional(),
    duasViasEmA4: z.boolean().optional(),
  });

  registrarCanal('pdf:gerar', opcoesPdf, ({ id: ordemId, ...opcoes }) =>
    gerarPdf(ordemId, caminhos, opcoes),
  );

  registrarCanal('pdf:imprimir', opcoesPdf, ({ id: ordemId, ...opcoes }) =>
    imprimir(ordemId, caminhos, opcoes),
  );

  /** Gera e já abre a pasta com o arquivo selecionado, para arrastar. */
  registrarCanal('pdf:gerarEAbrir', opcoesPdf, async ({ id: ordemId, ...opcoes }) => {
    const resultado = await gerarPdf(ordemId, caminhos, opcoes);
    revelarArquivo(resultado.caminho);
    return resultado;
  });

  registrarCanal('pdf:impressoras', semEntrada, () => listarImpressoras());

  registrarCanal('pdf:abrirPasta', semEntrada, async () => {
    await abrirPasta(caminhos.pdfs);
    return { pasta: caminhos.pdfs };
  });

  // ---------- WhatsApp ----------
  registrarCanal('whatsapp:estado', semEntrada, () => lerEstadoWhatsApp());
  registrarCanal('whatsapp:conectar', semEntrada, async () => {
    await iniciarWhatsApp(caminhos);
    return lerEstadoWhatsApp();
  });
  registrarCanal('whatsapp:desconectar', semEntrada, async () => {
    await desconectarWhatsApp();
    return lerEstadoWhatsApp();
  });
  registrarCanal('whatsapp:teste', z.object({ telefone: z.string() }), ({ telefone }) =>
    enviarTeste(telefone),
  );
  registrarCanal('whatsapp:enviarOrcamento', id, ({ id: ordemId }) =>
    enviarOrcamento(ordemId, caminhos),
  );
  registrarCanal('whatsapp:enviarComprovante', id, ({ id: ordemId }) =>
    enviarComprovanteEntrada(ordemId, caminhos),
  );
  registrarCanal('whatsapp:enviarMidias', id, ({ id: ordemId }) =>
    enviarMidiasDaOrdem(ordemId, caminhos),
  );
  registrarCanal('whatsapp:avisarPronto', id, ({ id: ordemId }) => avisarPronto(ordemId, caminhos));

  registrarCanal('whatsapp:grupos', semEntrada, () => listarGrupos(exigirSocket()));

  // Escolher um grupo troca a fonte das fotos; escolher "nenhum" volta para o
  // chat da oficina consigo mesma.
  registrarCanal(
    'whatsapp:definirGrupo',
    z.object({ jid: z.string().nullable(), nome: z.string().nullable() }),
    ({ jid, nome }) =>
      reposConfig.salvarConfig(ctx(), { whatsappGrupoJid: jid, whatsappGrupoNome: nome }),
  );

  // O estado da conexão muda sozinho (QR novo, queda, reconexão). Em vez de a
  // tela ficar perguntando, o main empurra a mudança assim que ela acontece.
  observarWhatsApp((estado) => {
    const janela = obterJanela();
    if (janela && !janela.isDestroyed()) {
      janela.webContents.send('whatsapp:mudou', estado);
    }
  });

  // ---------- backup ----------
  registrarCanal('backup:agora', semEntrada, async () => {
    const config = reposConfig.lerConfig(ctx());
    return fazerBackup(caminhos, config.pastaBackup);
  });

  registrarCanal('backup:listar', semEntrada, () => {
    const config = reposConfig.lerConfig(ctx());
    return {
      pasta: config.pastaBackup || caminhos.backups,
      ultimoEm: lerIndice(caminhos.backups).ultimoBackupEm,
      backups: listarBackups(caminhos, config.pastaBackup),
    };
  });

  registrarCanal('backup:escolherPasta', semEntrada, async () => {
    const escolha = await dialog.showOpenDialog({
      title: 'Onde guardar os backups',
      defaultPath: caminhos.backups,
      properties: ['openDirectory', 'createDirectory'],
    });
    if (escolha.canceled || !escolha.filePaths[0]) return null;

    reposConfig.salvarConfig(ctx(), { pastaBackup: escolha.filePaths[0] });
    return escolha.filePaths[0];
  });

  registrarCanal('backup:abrirPasta', semEntrada, async () => {
    const config = reposConfig.lerConfig(ctx());
    const pasta = config.pastaBackup || caminhos.backups;
    await abrirPasta(pasta);
    return { pasta };
  });

  /** Só escolhe e inspeciona; restaurar de verdade é outro canal. */
  registrarCanal('backup:escolherArquivo', semEntrada, async () => {
    const arquivo = await escolherBackup(caminhos);
    if (!arquivo) return null;
    return { arquivo, conteudo: await inspecionarBackup(arquivo) };
  });

  registrarCanal(
    'backup:restaurar',
    z.object({ arquivo: z.string().min(1) }),
    async ({ arquivo }) => {
      const resultado = await restaurarBackup(arquivo, caminhos);
      // O app inteiro já leu o banco antigo: reiniciar é obrigatório.
      setTimeout(reiniciarApp, 1500);
      return resultado;
    },
  );

  // ---------- atualização ----------
  registrarCanal('atualizacao:estado', semEntrada, () => lerEstadoAtualizacao());
  registrarCanal('atualizacao:procurar', semEntrada, () => procurarAtualizacao());
  registrarCanal('atualizacao:aplicar', semEntrada, async () => {
    await aplicarAtualizacao();
    return { aplicando: true };
  });

  // ---------- diagnóstico ----------
  registrarCanal('diagnostico:exportar', semEntrada, () => exportarDiagnostico(caminhos));

  // ---------- celular do mecânico ----------
  registrarCanal('celular:estado', semEntrada, async () => {
    const servidor = lerEstadoDoServidor();
    return {
      ...servidor,
      dispositivos: listarDispositivos(),
      firewallOk: await regraDeFirewallExiste(),
    };
  });

  /** Gera o QR que o celular lê. Vale 10 minutos e serve uma vez só. */
  registrarCanal('celular:qr', semEntrada, async () => {
    const servidor = lerEstadoDoServidor();
    if (!servidor.rodando || !servidor.ip) {
      throw new Error(
        servidor.erro ??
          'O computador não está numa rede. Conecte no Wi-Fi da oficina e tente de novo.',
      );
    }

    const { token, expiraEm } = gerarTokenDePareamento();
    const url = `http://${servidor.ip}:${servidor.porta}/parear?token=${token}`;

    return {
      url,
      expiraEm,
      qrDataUri: await QRCode.toDataURL(url, { margin: 1, width: 320 }),
    };
  });

  registrarCanal('celular:cancelarQr', semEntrada, () => {
    descartarTokenDePareamento();
    return { cancelado: true };
  });

  registrarCanal('celular:revogar', id, ({ id: dispositivoId }) => {
    revogarDispositivo(dispositivoId);
    return { revogado: true };
  });

  registrarCanal('celular:liberarFirewall', semEntrada, async () => {
    const liberou = await liberarPortaNoFirewall(lerEstadoDoServidor().porta);
    return { liberou, jaExistia: await regraDeFirewallExiste() };
  });

  // ---------- mídias ----------
  registrarCanal('midias:daOrdem', id, ({ id: ordemId }) => listarMidias(ctx(), ordemId));

  registrarCanal(
    'midias:enviarAoCliente',
    z.object({ id: z.number().int().positive(), incluir: z.boolean() }),
    ({ id: midiaId, incluir }) => definirEnvioAoCliente(ctx(), midiaId, incluir),
  );

  /** Caixa de entrada: o que chegou pelo WhatsApp sem OS identificada. */
  registrarCanal('midias:semOs', semEntrada, () => listarMidiasSemOs(ctx()));

  registrarCanal(
    'midias:anexar',
    z.object({ id: z.number().int().positive(), ordemId: z.number().int().positive() }),
    ({ id: midiaId, ordemId }) => {
      const contexto = ctx();
      const ordem = reposOrdens.buscarOrdem(contexto, ordemId);
      if (!ordem) throw new Error('Essa OS não foi encontrada.');

      const midia = anexarMidiaAOrdem(contexto, midiaId, ordemId);
      reposEventos.registrarEvento(contexto, {
        ordemId,
        tipo: 'midia',
        descricao: 'Anexou uma mídia que tinha chegado sem OS',
      });
      return midia;
    },
  );

  // ---------- busca global (Ctrl+K) ----------
  registrarCanal('busca:global', z.object({ termo: z.string() }), ({ termo }) =>
    reposBusca.buscaGlobal(ctx(), termo),
  );
}
