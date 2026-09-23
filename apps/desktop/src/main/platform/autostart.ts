import { app } from 'electron';
import { log } from '../log.js';
import { EH_WINDOWS } from './guarda.js';

/**
 * O sistema precisa subir junto com o Windows: o WhatsApp e o servidor da LAN
 * ficam em segundo plano, e o mecanico nao deve depender de alguem "abrir o
 * programa" no notebook.
 */
export function configurarInicioAutomatico(ligado: boolean): void {
  if (!EH_WINDOWS) {
    log.info(`[platform] início automático ignorado fora do Windows (pedido: ${ligado})`);
    return;
  }

  app.setLoginItemSettings({
    openAtLogin: ligado,
    // Sobe direto para a bandeja, sem roubar a tela de quem esta ligando o PC.
    args: ['--minimizado'],
  });
  log.info(`[platform] início automático com o Windows: ${ligado ? 'ligado' : 'desligado'}`);
}

export function inicioAutomaticoLigado(): boolean {
  if (!EH_WINDOWS) return false;
  return app.getLoginItemSettings().openAtLogin;
}
