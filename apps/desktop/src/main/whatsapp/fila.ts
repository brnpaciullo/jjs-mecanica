import { log } from '../log.js';

/**
 * Fila sequencial com intervalo mínimo entre envios.
 *
 * Proteção anti-banimento: o WhatsApp derruba número que dispara mensagem em
 * rajada. Aqui nada é paralelo e nada sai antes de passar o intervalo desde o
 * envio anterior. Combinado com a regra de só enviar por ação humana, é o que
 * mantém o número da oficina vivo.
 */
export class FilaDeEnvio {
  private fila: Array<() => Promise<void>> = [];
  private rodando = false;
  private ultimoEnvio = 0;

  constructor(
    private readonly intervaloMs: number,
    private readonly aoMudarTamanho?: (tamanho: number) => void,
  ) {}

  get tamanho(): number {
    return this.fila.length + (this.rodando ? 1 : 0);
  }

  /** Enfileira e resolve quando aquele envio terminar. */
  enfileirar<T>(tarefa: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolver, rejeitar) => {
      this.fila.push(async () => {
        try {
          resolver(await tarefa());
        } catch (erro) {
          rejeitar(erro);
        }
      });
      this.aoMudarTamanho?.(this.tamanho);
      void this.processar();
    });
  }

  private async processar(): Promise<void> {
    if (this.rodando) return;
    this.rodando = true;

    while (this.fila.length > 0) {
      const espera = this.intervaloMs - (Date.now() - this.ultimoEnvio);
      if (espera > 0) await new Promise((r) => setTimeout(r, espera));

      const tarefa = this.fila.shift();
      this.aoMudarTamanho?.(this.tamanho);
      if (!tarefa) break;

      try {
        await tarefa();
      } catch (erro) {
        // O erro já foi entregue a quem chamou; aqui só registra.
        log.warn('[whatsapp] um envio da fila falhou', erro);
      }
      this.ultimoEnvio = Date.now();
    }

    this.rodando = false;
    this.aoMudarTamanho?.(this.tamanho);
  }
}
