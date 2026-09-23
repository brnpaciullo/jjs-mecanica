/** O que a tela precisa saber sobre a conexão. */
export interface EstadoWhatsApp {
  situacao: 'desconectado' | 'conectando' | 'lendo_qr' | 'conectado';
  /** QR como data URI, pronto para um <img>. Só existe em `lendo_qr`. */
  qrDataUri: string | null;
  /** Número conectado, em E.164, quando já pareado. */
  numero: string | null;
  nome: string | null;
  /** Mensagem em português dizendo o que fazer, quando algo deu errado. */
  aviso: string | null;
  /** Quantas mensagens estão esperando na fila. */
  naFila: number;
}

export const ESTADO_INICIAL: EstadoWhatsApp = {
  situacao: 'desconectado',
  qrDataUri: null,
  numero: null,
  nome: null,
  aviso: null,
  naFila: 0,
};
