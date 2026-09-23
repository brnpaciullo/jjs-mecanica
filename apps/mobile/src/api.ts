/**
 * Cliente da API do balcão.
 *
 * Toda chamada leva o cookie do dispositivo (`credentials: 'include'`), que é
 * o que prova que este celular foi pareado. Os dois erros que a tela precisa
 * distinguir estão tipados: não pareado e sem PIN levam a telas diferentes.
 */
export class ErroDaApi extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
    readonly codigo?: string,
  ) {
    super(mensagem);
    this.name = 'ErroDaApi';
  }

  get precisaParear(): boolean {
    return this.status === 401;
  }

  get precisaDePin(): boolean {
    return this.status === 403;
  }

  /** Notebook desligado, Wi-Fi errado, cabo fora. */
  get semConexao(): boolean {
    return this.status === 0;
  }
}

async function chamar<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  let resposta: Response;

  try {
    resposta = await fetch(caminho, { credentials: 'include', ...opcoes });
  } catch {
    throw new ErroDaApi(
      0,
      'Não encontrei o computador da oficina. Confira se ele está ligado e se o celular está no Wi-Fi da oficina.',
    );
  }

  if (!resposta.ok) {
    let mensagem = 'Algo deu errado. Tente de novo.';
    let codigo: string | undefined;
    try {
      const corpo = (await resposta.json()) as { mensagem?: string; erro?: string };
      mensagem = corpo.mensagem ?? mensagem;
      codigo = corpo.erro;
    } catch {
      // resposta sem JSON: fica a mensagem padrão
    }
    throw new ErroDaApi(resposta.status, mensagem, codigo);
  }

  return (await resposta.json()) as T;
}

const json = (corpo: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(corpo),
});

export interface Eu {
  dispositivo: string | null;
  usuarioId: number | null;
  precisaDePin: boolean;
}

export interface OrdemNoQuadro {
  id: number;
  numero: number;
  status: string;
  queixas: string;
  criadoEm: string;
  clienteNome: string;
  marca: string;
  modelo: string;
  placa: string;
  totalMidias: number;
}

export interface MidiaNaTela {
  id: number;
  tipo: 'foto' | 'video';
  url: string;
  thumbUrl: string | null;
  momento: 'entrada' | 'diagnostico' | 'servico';
  statusProcessamento: 'pendente' | 'pronto' | 'erro';
  legenda: string | null;
  criadoEm: string;
}

export interface ItemDaOs {
  id: number;
  tipo: 'peca' | 'mao_de_obra';
  descricao: string;
  quantidade: number;
  valorUnitarioCentavos: number;
  observacao: string | null;
  aprovado: boolean;
}

export interface OsCompleta {
  ordem: {
    id: number;
    numero: number;
    status: string;
    queixas: string;
    diagnostico: string | null;
    kmEntrada: number | null;
  };
  detalhe: { marca: string; modelo: string; placa: string; clienteNome: string } | null;
  itens: ItemDaOs[];
  totais: {
    totalCentavos: number;
    subtotalPecasCentavos: number;
    subtotalMaoDeObraCentavos: number;
  };
  midias: MidiaNaTela[];
}

export const api = {
  eu: () => chamar<Eu>('/api/eu'),
  entrar: (pin: string) =>
    chamar<{ usuario: { id: number; nome: string } }>('/api/entrar', json({ pin })),
  quadro: () => chamar<OrdemNoQuadro[]>('/api/quadro'),
  os: (id: number) => chamar<OsCompleta>(`/api/os/${id}`),
  atualizarOs: (id: number, dados: Record<string, unknown>) =>
    chamar(`/api/os/${id}`, { ...json(dados), method: 'PATCH' }),
  mudarStatus: (id: number, status: string) => chamar(`/api/os/${id}/status`, json({ status })),
  adicionarItem: (id: number, dados: Record<string, unknown>) =>
    chamar<ItemDaOs>(`/api/os/${id}/itens`, json(dados)),
  atualizarItem: (id: number, dados: Record<string, unknown>) =>
    chamar<ItemDaOs>(`/api/itens/${id}`, { ...json(dados), method: 'PATCH' }),
  removerItem: (id: number) => chamar(`/api/itens/${id}`, { method: 'DELETE' }),
  catalogo: (termo: string) =>
    chamar<
      {
        id: number;
        descricao: string;
        tipo: 'peca' | 'mao_de_obra';
        valorPadraoCentavos: number | null;
      }[]
    >(`/api/catalogo?termo=${encodeURIComponent(termo)}`),
  midias: (id: number) => chamar<MidiaNaTela[]>(`/api/os/${id}/midias`),
  buscar: (termo: string) =>
    chamar<{
      clientes: { id: number; nome: string; telefone: string }[];
      veiculos: {
        id: number;
        placa: string;
        marca: string;
        modelo: string;
        clienteId: number;
        clienteNome: string;
      }[];
    }>(`/api/buscar?termo=${encodeURIComponent(termo)}`),
  abrirAtendimento: (dados: Record<string, unknown>) =>
    chamar<{ id: number; numero: number }>('/api/atendimento', json(dados)),
};
