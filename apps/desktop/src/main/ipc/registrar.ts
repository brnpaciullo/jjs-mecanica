import { ipcMain } from 'electron';
import { z } from 'zod';
import { log } from '../log.js';

type Manipulador<E extends z.ZodTypeAny> = (
  entrada: z.infer<E>,
  evento: Electron.IpcMainInvokeEvent,
) => unknown;

/**
 * Todo canal IPC passa por aqui. Motivos:
 * - a entrada e validada com zod antes de encostar na regra de negocio;
 * - o erro vira uma mensagem em portugues que diz o que fazer, em vez de
 *   vazar um stack trace para a tela;
 * - quando a etapa 6 expuser os mesmos casos de uso na API REST do mobile,
 *   os dois caminhos chamam a mesma funcao de dominio, sem regra duplicada.
 */
export function registrarCanal<E extends z.ZodTypeAny>(
  canal: string,
  esquema: E,
  manipulador: Manipulador<E>,
): void {
  ipcMain.handle(canal, async (evento, bruto: unknown) => {
    const analise = esquema.safeParse(bruto);
    if (!analise.success) {
      const primeiro = analise.error.issues[0];
      log.warn(`[ipc] ${canal} recebeu dado inválido`, analise.error.issues);
      throw new Error(primeiro?.message ?? 'Não entendi os dados enviados pela tela.');
    }

    try {
      return await manipulador(analise.data, evento);
    } catch (erro) {
      log.error(`[ipc] ${canal} falhou`, erro);
      // A mensagem vai limpa para a tela, mas a causa original fica no log.
      throw new Error(paraMensagemDeTela(erro), { cause: erro });
    }
  });
}

export const semEntrada = z.undefined().or(z.null()).or(z.void());

/**
 * Última barreira antes da tela. Um ZodError traz em `.message` um dump JSON
 * das falhas; os repositórios já convertem isso em ErroDeNegocio, mas se algum
 * escapar daqui para frente a oficina não pode ver JSON na tela.
 */
function paraMensagemDeTela(erro: unknown): string {
  if (erro instanceof z.ZodError) {
    return erro.issues[0]?.message ?? 'Confira os dados preenchidos.';
  }
  if (erro instanceof Error && erro.message) return erro.message;
  return 'Algo deu errado. Tente de novo.';
}
