import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { log } from '../log.js';
import { EH_WINDOWS } from './guarda.js';

const executar = promisify(execFile);

export const NOME_REGRA = 'JJS Mecanica - celular do mecanico';

/**
 * Sem a regra de entrada o celular nao conecta no notebook, e a mensagem que o
 * mecanico ve e um "nao encontrei o computador da oficina" sem explicacao.
 * O instalador cria a regra; isto aqui serve para conferir e recriar pela tela
 * de Configuracoes. Usado de verdade na etapa 6.
 */
export async function liberarPortaNoFirewall(porta: number): Promise<boolean> {
  if (!EH_WINDOWS) {
    log.info(`[platform] regra de firewall para a porta ${porta} ignorada fora do Windows`);
    return false;
  }

  try {
    await executar('netsh', [
      'advfirewall',
      'firewall',
      'add',
      'rule',
      `name=${NOME_REGRA}`,
      'dir=in',
      'action=allow',
      'protocol=TCP',
      `localport=${porta}`,
      'profile=private',
    ]);
    log.info(`[platform] porta ${porta} liberada no firewall`);
    return true;
  } catch (erro) {
    log.error('[platform] não consegui criar a regra de firewall', erro);
    return false;
  }
}

export async function regraDeFirewallExiste(): Promise<boolean> {
  if (!EH_WINDOWS) return false;
  try {
    await executar('netsh', ['advfirewall', 'firewall', 'show', 'rule', `name=${NOME_REGRA}`]);
    return true;
  } catch {
    return false;
  }
}
