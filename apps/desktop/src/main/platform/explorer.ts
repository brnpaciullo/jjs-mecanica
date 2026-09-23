import { shell } from 'electron';
import { log } from '../log.js';
import { EH_WINDOWS } from './guarda.js';

/**
 * Abrir a pasta do PDF para a secretaria arrastar o arquivo no WhatsApp Web
 * e o plano B quando o Baileys esta desconectado (etapa 5).
 * shell funciona nos dois sistemas; a guarda existe so para o log deixar claro
 * o que acontece em dev.
 */
export async function abrirPasta(caminho: string): Promise<void> {
  if (!EH_WINDOWS) {
    log.info(`[platform] abrindo pasta fora do Windows (gerenciador padrão): ${caminho}`);
  }
  await shell.openPath(caminho);
}

/** Abre a pasta ja com o arquivo selecionado. */
export function revelarArquivo(caminho: string): void {
  shell.showItemInFolder(caminho);
}
