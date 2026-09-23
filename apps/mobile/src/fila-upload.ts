import { ErroDaApi } from './api.js';

export type SituacaoEnvio = 'esperando' | 'enviando' | 'enviado' | 'erro';

export interface ItemDaFila {
  id: string;
  ordemId: number;
  nomeArquivo: string;
  tipo: 'foto' | 'video';
  momento: 'entrada' | 'diagnostico' | 'servico';
  legenda: string | null;
  arquivo: File | Blob;
  situacao: SituacaoEnvio;
  progresso: number;
  tentativas: number;
  erro: string | null;
}

type Ouvinte = (fila: ItemDaFila[]) => void;

const MAX_TENTATIVAS = 5;

/**
 * Fila de envio de fotos e vídeos.
 *
 * O Wi-Fi de oficina cai: o mecânico anda até embaixo do carro e perde o
 * sinal. Aqui nada se perde — o item fica na fila, tenta de novo com espera
 * crescente, e o mecânico continua trabalhando enquanto isso. Um envio de cada
 * vez, porque vídeo é pesado e paralelizar em rede ruim só piora.
 */
class FilaDeUpload {
  private itens: ItemDaFila[] = [];
  private ouvintes: Ouvinte[] = [];
  private rodando = false;

  observar(ouvinte: Ouvinte): () => void {
    this.ouvintes.push(ouvinte);
    ouvinte(this.itens);
    return () => {
      this.ouvintes = this.ouvintes.filter((o) => o !== ouvinte);
    };
  }

  private avisar(): void {
    const copia = [...this.itens];
    for (const o of this.ouvintes) o(copia);
  }

  adicionar(
    entrada: Omit<ItemDaFila, 'id' | 'situacao' | 'progresso' | 'tentativas' | 'erro'>,
  ): void {
    this.itens.push({
      ...entrada,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      situacao: 'esperando',
      progresso: 0,
      tentativas: 0,
      erro: null,
    });
    this.avisar();
    void this.processar();
  }

  /** Tira da lista o que já subiu; o que falhou fica visível de propósito. */
  limparEnviados(): void {
    this.itens = this.itens.filter((i) => i.situacao !== 'enviado');
    this.avisar();
  }

  tentarDeNovo(id: string): void {
    const item = this.itens.find((i) => i.id === id);
    if (!item) return;
    item.situacao = 'esperando';
    item.tentativas = 0;
    item.erro = null;
    this.avisar();
    void this.processar();
  }

  descartar(id: string): void {
    this.itens = this.itens.filter((i) => i.id !== id);
    this.avisar();
  }

  private async processar(): Promise<void> {
    if (this.rodando) return;
    this.rodando = true;

    while (true) {
      const item = this.itens.find((i) => i.situacao === 'esperando');
      if (!item) break;

      item.situacao = 'enviando';
      item.progresso = 0;
      this.avisar();

      try {
        await this.enviar(item);
        item.situacao = 'enviado';
        item.progresso = 100;
        item.erro = null;
      } catch (erro) {
        item.tentativas += 1;

        const daApi = erro instanceof ErroDaApi;
        // Não adianta insistir quando o problema é de sessão: quem resolve é
        // a pessoa, digitando o PIN ou pareando de novo.
        const semSentidoTentar = daApi && (erro.precisaDePin || erro.precisaParear);

        if (semSentidoTentar || item.tentativas >= MAX_TENTATIVAS) {
          item.situacao = 'erro';
          item.erro = erro instanceof Error ? erro.message : 'Não consegui enviar.';
        } else {
          item.situacao = 'esperando';
          item.erro = `Tentando de novo (${item.tentativas}/${MAX_TENTATIVAS})...`;
          // Espera crescente: 2s, 4s, 8s... dá tempo do Wi-Fi voltar.
          await new Promise((r) =>
            setTimeout(r, Math.min(2000 * 2 ** (item.tentativas - 1), 30_000)),
          );
        }
      }

      this.avisar();
    }

    this.rodando = false;
  }

  /** XMLHttpRequest e não fetch: só ele reporta progresso de upload. */
  private enviar(item: ItemDaFila): Promise<void> {
    return new Promise((resolver, rejeitar) => {
      const form = new FormData();
      form.append('momento', item.momento);
      if (item.legenda) form.append('legenda', item.legenda);
      form.append('arquivo', item.arquivo, item.nomeArquivo);

      const req = new XMLHttpRequest();
      req.open('POST', `/api/os/${item.ordemId}/midias`);
      req.withCredentials = true;

      req.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          item.progresso = Math.round((e.loaded / e.total) * 100);
          this.avisar();
        }
      };

      req.onload = () => {
        if (req.status >= 200 && req.status < 300) {
          resolver();
          return;
        }
        let mensagem = 'Não consegui enviar.';
        try {
          mensagem = (JSON.parse(req.responseText) as { mensagem?: string }).mensagem ?? mensagem;
        } catch {
          // resposta sem JSON
        }
        rejeitar(new ErroDaApi(req.status, mensagem));
      };

      req.onerror = () => rejeitar(new ErroDaApi(0, 'A conexão caiu no meio do envio.'));
      req.ontimeout = () => rejeitar(new ErroDaApi(0, 'O envio demorou demais.'));

      req.send(form);
    });
  }
}

export const filaDeUpload = new FilaDeUpload();

/**
 * Reduz a foto antes de enviar.
 *
 * Uma foto de celular tem 4 a 8 MB. No Wi-Fi de oficina isso demora e falha;
 * com 1920px de lado maior ela cai para algumas centenas de KB e continua
 * ótima para mostrar uma peça no orçamento. Feito com canvas, que funciona em
 * HTTP puro — nada aqui depende de HTTPS.
 */
export async function reduzirFoto(arquivo: File, ladoMaior = 1920, qualidade = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo).catch(() => null);
  if (!bitmap) return arquivo;

  const escala = Math.min(1, ladoMaior / Math.max(bitmap.width, bitmap.height));
  if (escala === 1 && arquivo.size < 1_500_000) return arquivo;

  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const tela = document.createElement('canvas');
  tela.width = largura;
  tela.height = altura;

  const ctx = tela.getContext('2d');
  if (!ctx) return arquivo;
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  const reduzida = await new Promise<Blob | null>((r) => tela.toBlob(r, 'image/jpeg', qualidade));
  // Se a redução não ajudou, manda o original mesmo.
  return reduzida && reduzida.size < arquivo.size ? reduzida : arquivo;
}
