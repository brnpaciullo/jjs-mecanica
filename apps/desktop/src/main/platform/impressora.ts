import { shell } from 'electron';
import { log } from '../log.js';
import { EH_WINDOWS } from './guarda.js';

/**
 * Impressao do orcamento em A5. Etapa 4.
 * Fica aqui porque o comportamento de driver e de "abrir as configuracoes de
 * impressora" e especifico do sistema.
 */
export async function abrirConfiguracoesDeImpressora(): Promise<void> {
  if (!EH_WINDOWS) {
    log.info('[platform] configurações de impressora não disponíveis fora do Windows');
    return;
  }
  await shell.openExternal('ms-settings:printers');
}
