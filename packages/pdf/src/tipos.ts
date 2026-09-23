import type { StatusOrdem, Totais } from '@jjs/core';

export interface ItemPdf {
  tipo: 'peca' | 'mao_de_obra';
  descricao: string;
  quantidade: number;
  valorUnitarioCentavos: number;
  observacao: string | null;
  aprovado: boolean;
}

export interface FotoPdf {
  /** Imagem embutida: o PDF precisa ser um arquivo só. */
  dataUri: string;
  legenda: string | null;
}

export interface DadosPdf {
  oficina: {
    nome: string;
    cnpj: string | null;
    endereco: string | null;
    telefone: string | null;
    /** Logo embutido como data URI, ou nulo. */
    logoDataUri: string | null;
    textoGarantia: string | null;
    mensagemRodape: string | null;
    /** Faixa amarela fina em vez de bloco escuro. */
    economizarTinta: boolean;
  };
  ordem: {
    numero: number;
    status: StatusOrdem;
    criadoEm: string;
    queixas: string;
    diagnostico: string | null;
    prazoEstimado: string | null;
    validadeAte: string | null;
    formaPagamento: string | null;
    kmEntrada: number | null;
    combustivel: string | null;
    /** Avarias, objetos deixados no carro e observações da recepção. */
    checklistEntrada: { avarias: string[]; objetos: string[]; observacoes: string } | null;
    descontoCentavos: number;
  };
  cliente: { nome: string; telefone: string };
  veiculo: {
    marca: string;
    modelo: string;
    placa: string;
    ano: number | null;
    cor: string | null;
  };
  itens: ItemPdf[];
  fotos: FotoPdf[];
}

/**
 * `recibo_entrada` é o comprovante de que a oficina recebeu o carro: registra
 * o estado dele na chegada e **não fala de dinheiro**. `orcamento` mostra
 * todos os itens; `ordem_servico` mostra só os aprovados.
 *
 * Quem decide é o status, mas dá para forçar (reimprimir o orçamento original
 * depois de aprovado, por exemplo).
 */
export type VariacaoPdf = 'recibo_entrada' | 'orcamento' | 'ordem_servico';

export interface OpcoesPdf {
  variacao?: VariacaoPdf;
  /** Duas vias A5 lado a lado numa folha A4 deitada, para cortar ao meio. */
  duasViasEmA4?: boolean;
}

export interface ResultadoTemplate {
  html: string;
  variacao: VariacaoPdf;
  titulo: string;
  totais: Totais;
  /** Nome sugerido: Orcamento-OS0001-ABC1D23.pdf, Entrada-OS0001-... */
  nomeArquivo: string;
}
