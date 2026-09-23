import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  CatalogoRegistro,
  ClienteRegistro,
  ConfigEditavel,
  ConfigRegistro,
  EventoNaTela,
  FiltroHistorico,
  ItemRegistro,
  OrdemNaLista,
  OrdemRegistro,
  ResultadoBusca,
  UsuarioRegistro,
  VeiculoComDono,
  VeiculoRegistro,
} from '@jjs/db';
import type {
  Categoria,
  ChecklistEntrada,
  Combustivel,
  NovoCliente,
  NovoVeiculo,
  Papel,
  StatusOrdem,
  TipoItem,
  Totais,
} from '@jjs/core';
import type { VariacaoPdf } from '@jjs/pdf';
import type { CaminhosApp } from '../main/caminhos.js';
import type { InfoApp } from '../main/ipc/canais.js';
import type { ImpressoraNaTela, ResultadoPdf } from '../main/pdf.js';
import type { EstadoWhatsApp } from '../main/whatsapp/estado.js';
import type { BackupNaTela, ResultadoBackup } from '../main/backup/fazer.js';
import type { ConteudoBackup, ResultadoRestauracao } from '../main/backup/restaurar.js';
import type { EstadoAtualizacao } from '../main/atualizacao.js';
import type { EstadoDoServidor } from '../main/lan/servidor.js';
import type { MidiaNaTela } from '../main/midias/consultar.js';
import type { ResultadoEnvio } from '../main/whatsapp/envio.js';

/**
 * Única ponte entre a tela e o processo main. O renderer nunca vê o Node:
 * contextIsolation ligado e nodeIntegration desligado.
 *
 * Cada função é um espelho fino de um canal IPC — sem lógica, para não existir
 * regra escondida no meio do caminho. Os tipos vêm de @jjs/db e @jjs/core, que
 * são a mesma fonte que o main usa: se um repositório mudar de forma, a tela
 * para de compilar em vez de quebrar em produção.
 */
const invocar = <T>(canal: string, entrada?: unknown): Promise<T> =>
  ipcRenderer.invoke(canal, entrada) as Promise<T>;

/** Resposta de `ordens.abrir`: tudo que a tela da OS precisa, numa chamada. */
export interface OrdemCompleta {
  ordem: OrdemRegistro;
  detalhe: OrdemNaLista | null;
  itens: ItemRegistro[];
  totais: Totais;
  eventos: EventoNaTela[];
}

export interface NovaOrdemEntrada {
  clienteId: number;
  veiculoId: number;
  queixas: string;
  kmEntrada?: number | null;
  combustivel?: Combustivel | null;
  checklistEntrada?: ChecklistEntrada | null;
}

export interface EntradaPdf {
  id: number;
  /** Forçar a variação; por padrão o status da OS decide. */
  variacao?: VariacaoPdf;
  /** Duas vias A5 numa folha A4 deitada, para quem não tem papel A5. */
  duasViasEmA4?: boolean;
}

export interface ItemEntrada {
  tipo: TipoItem;
  descricao: string;
  quantidade?: number;
  valorUnitarioCentavos: number;
  observacao?: string | null;
  aprovado?: boolean;
}

const api = {
  info: () => invocar<InfoApp>('app:info'),
  caminhos: () => invocar<CaminhosApp>('app:caminhos'),

  config: {
    ler: () => invocar<ConfigRegistro>('config:ler'),
    salvar: (entrada: ConfigEditavel) => invocar<ConfigRegistro>('config:salvar', entrada),
  },

  usuarios: {
    listar: () => invocar<UsuarioRegistro[]>('usuarios:listar'),
    criar: (entrada: { nome: string; papel: Papel; pin?: string | null }) =>
      invocar<UsuarioRegistro>('usuarios:criar', entrada),
    atualizar: (entrada: {
      id: number;
      nome?: string;
      papel?: Papel;
      pin?: string | null;
      ativo?: boolean;
    }) => invocar<UsuarioRegistro>('usuarios:atualizar', entrada),
  },

  clientes: {
    listar: (termo = '') => invocar<ClienteRegistro[]>('clientes:listar', { termo }),
    buscar: (id: number) => invocar<ClienteRegistro | null>('clientes:buscar', { id }),
    criar: (entrada: NovoCliente) => invocar<ClienteRegistro>('clientes:criar', entrada),
    atualizar: (entrada: Partial<NovoCliente> & { id: number }) =>
      invocar<ClienteRegistro>('clientes:atualizar', entrada),
    arquivar: (id: number, arquivado = true) =>
      invocar<ClienteRegistro>('clientes:arquivar', { id, arquivado }),
  },

  veiculos: {
    listar: (termo = '') => invocar<VeiculoComDono[]>('veiculos:listar', { termo }),
    buscar: (id: number) => invocar<VeiculoComDono | null>('veiculos:buscar', { id }),
    doCliente: (clienteId: number) =>
      invocar<VeiculoRegistro[]>('veiculos:doCliente', { clienteId }),
    porPlaca: (placa: string) => invocar<VeiculoComDono | null>('veiculos:porPlaca', { placa }),
    criar: (entrada: NovoVeiculo) => invocar<VeiculoRegistro>('veiculos:criar', entrada),
    atualizar: (entrada: Partial<NovoVeiculo> & { id: number }) =>
      invocar<VeiculoRegistro>('veiculos:atualizar', entrada),
    arquivar: (id: number, arquivado = true) =>
      invocar<VeiculoRegistro>('veiculos:arquivar', { id, arquivado }),
  },

  catalogo: {
    listar: (termo = '') => invocar<CatalogoRegistro[]>('catalogo:listar', { termo }),
    sugerir: (termo: string) => invocar<CatalogoRegistro[]>('catalogo:sugerir', { termo }),
    criar: (entrada: {
      descricao: string;
      tipo: TipoItem;
      valorPadraoCentavos?: number | null;
      categoria?: Categoria | null;
    }) => invocar<CatalogoRegistro>('catalogo:criar', entrada),
    atualizar: (entrada: {
      id: number;
      descricao?: string;
      tipo?: TipoItem;
      valorPadraoCentavos?: number | null;
      categoria?: Categoria | null;
    }) => invocar<CatalogoRegistro>('catalogo:atualizar', entrada),
    arquivar: (id: number, ativo = false) =>
      invocar<CatalogoRegistro>('catalogo:arquivar', { id, ativo }),
  },

  ordens: {
    quadro: () => invocar<OrdemNaLista[]>('ordens:quadro'),
    historico: (filtro: FiltroHistorico = {}) =>
      invocar<OrdemNaLista[]>('ordens:historico', filtro),
    criar: (entrada: NovaOrdemEntrada) => invocar<OrdemRegistro>('ordens:criar', entrada),
    abrir: (id: number) => invocar<OrdemCompleta | null>('ordens:abrir', { id }),
    atualizar: (entrada: {
      id: number;
      queixas?: string;
      diagnostico?: string | null;
      descontoCentavos?: number;
      prazoEstimado?: string | null;
      formaPagamento?: string | null;
      observacoesGerais?: string | null;
      kmEntrada?: number | null;
      combustivel?: Combustivel | null;
      pago?: boolean;
    }) => invocar<OrdemRegistro>('ordens:atualizar', entrada),
    mudarStatus: (entrada: {
      id: number;
      status: StatusOrdem;
      kmSaida?: number | null;
      formaPagamento?: string | null;
    }) => invocar<OrdemRegistro>('ordens:mudarStatus', entrada),
    doVeiculo: (veiculoId: number) => invocar<OrdemNaLista[]>('ordens:doVeiculo', { veiculoId }),
    doCliente: (clienteId: number) => invocar<OrdemNaLista[]>('ordens:doCliente', { clienteId }),
  },

  itens: {
    adicionar: (entrada: ItemEntrada & { ordemId: number }) =>
      invocar<ItemRegistro>('itens:adicionar', entrada),
    atualizar: (entrada: Partial<ItemEntrada> & { id: number }) =>
      invocar<ItemRegistro>('itens:atualizar', entrada),
    remover: (id: number) => invocar<{ removido: boolean }>('itens:remover', { id }),
    reordenar: (ordemId: number, ids: number[]) =>
      invocar<ItemRegistro[]>('itens:reordenar', { ordemId, ids }),
    aprovarTodos: (ordemId: number, aprovado: boolean) =>
      invocar<ItemRegistro[]>('itens:aprovarTodos', { ordemId, aprovado }),
  },

  logo: {
    escolher: () => invocar<string | null>('logo:escolher'),
    remover: () => invocar<{ removido: boolean }>('logo:remover'),
  },

  pdf: {
    gerar: (entrada: EntradaPdf) => invocar<ResultadoPdf>('pdf:gerar', entrada),
    imprimir: (entrada: EntradaPdf) =>
      invocar<{ impresso: boolean; motivo?: string }>('pdf:imprimir', entrada),
    gerarEAbrir: (entrada: EntradaPdf) => invocar<ResultadoPdf>('pdf:gerarEAbrir', entrada),
    impressoras: () => invocar<ImpressoraNaTela[]>('pdf:impressoras'),
    abrirPasta: () => invocar<{ pasta: string }>('pdf:abrirPasta'),
  },

  whatsapp: {
    estado: () => invocar<EstadoWhatsApp>('whatsapp:estado'),
    conectar: () => invocar<EstadoWhatsApp>('whatsapp:conectar'),
    desconectar: () => invocar<EstadoWhatsApp>('whatsapp:desconectar'),
    teste: (telefone: string) => invocar<ResultadoEnvio>('whatsapp:teste', { telefone }),
    enviarOrcamento: (id: number) => invocar<ResultadoEnvio>('whatsapp:enviarOrcamento', { id }),
    avisarPronto: (id: number) => invocar<ResultadoEnvio>('whatsapp:avisarPronto', { id }),
    /**
     * Escuta as mudanças de conexão empurradas pelo main (QR novo, queda,
     * reconexão). Devolve a função de parar de escutar.
     */
    aoMudar: (ouvinte: (estado: EstadoWhatsApp) => void) => {
      const embrulho = (_evento: IpcRendererEvent, estado: EstadoWhatsApp) => ouvinte(estado);
      ipcRenderer.on('whatsapp:mudou', embrulho);
      return () => ipcRenderer.removeListener('whatsapp:mudou', embrulho);
    },
  },

  backup: {
    agora: () => invocar<ResultadoBackup>('backup:agora'),
    listar: () =>
      invocar<{ pasta: string; ultimoEm: string | null; backups: BackupNaTela[] }>('backup:listar'),
    escolherPasta: () => invocar<string | null>('backup:escolherPasta'),
    abrirPasta: () => invocar<{ pasta: string }>('backup:abrirPasta'),
    escolherArquivo: () =>
      invocar<{ arquivo: string; conteudo: ConteudoBackup } | null>('backup:escolherArquivo'),
    restaurar: (arquivo: string) => invocar<ResultadoRestauracao>('backup:restaurar', { arquivo }),
  },

  atualizacao: {
    estado: () => invocar<EstadoAtualizacao>('atualizacao:estado'),
    procurar: () => invocar<EstadoAtualizacao>('atualizacao:procurar'),
    aplicar: () => invocar<{ aplicando: boolean }>('atualizacao:aplicar'),
    /** O main empurra o andamento do download. Devolve como parar de ouvir. */
    aoMudar: (ouvinte: (estado: EstadoAtualizacao) => void) => {
      const embrulho = (_e: IpcRendererEvent, estado: EstadoAtualizacao) => ouvinte(estado);
      ipcRenderer.on('atualizacao:mudou', embrulho);
      return () => ipcRenderer.removeListener('atualizacao:mudou', embrulho);
    },
  },

  diagnostico: {
    exportar: () => invocar<string | null>('diagnostico:exportar'),
  },

  celular: {
    estado: () =>
      invocar<
        EstadoDoServidor & {
          dispositivos: {
            id: number;
            nome: string;
            ultimoAcesso: string | null;
            revogado: boolean;
            temSessaoAberta: boolean;
          }[];
          firewallOk: boolean;
        }
      >('celular:estado'),
    qr: () => invocar<{ url: string; expiraEm: number; qrDataUri: string }>('celular:qr'),
    cancelarQr: () => invocar<{ cancelado: boolean }>('celular:cancelarQr'),
    revogar: (id: number) => invocar<{ revogado: boolean }>('celular:revogar', { id }),
    liberarFirewall: () =>
      invocar<{ liberou: boolean; jaExistia: boolean }>('celular:liberarFirewall'),
  },

  midias: {
    daOrdem: (id: number) => invocar<MidiaNaTela[]>('midias:daOrdem', { id }),
    enviarAoCliente: (id: number, incluir: boolean) =>
      invocar<unknown>('midias:enviarAoCliente', { id, incluir }),
    semOs: () => invocar<MidiaNaTela[]>('midias:semOs'),
    anexar: (id: number, ordemId: number) => invocar<MidiaNaTela>('midias:anexar', { id, ordemId }),
  },

  busca: {
    global: (termo: string) => invocar<ResultadoBusca[]>('busca:global', { termo }),
  },
} as const;

export type ApiJjs = typeof api;

contextBridge.exposeInMainWorld('jjs', api);
