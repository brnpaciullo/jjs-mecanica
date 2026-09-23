import { reposConfig } from '@jjs/db';
import { obterBanco, obterUsuarioPadrao } from '../banco.js';
import type { CaminhosApp } from '../caminhos.js';
import { log } from '../log.js';
import { fazerBackup } from './fazer.js';
import { lerIndice, precisaDeBackup } from './indice.js';

const UM_DIA_MS = 24 * 60 * 60 * 1000;
/** Espera antes do backup de inicialização, para não disputar com o boot. */
const ATRASO_NO_BOOT_MS = 60_000;

let timerDiario: ReturnType<typeof setInterval> | null = null;
let timerBoot: ReturnType<typeof setTimeout> | null = null;
let rodando = false;

function pastaConfigurada(): string | null {
  try {
    return reposConfig.lerConfig({ db: obterBanco(), usuarioId: obterUsuarioPadrao() }).pastaBackup;
  } catch {
    return null;
  }
}

/**
 * Faz o backup sem deixar o erro subir.
 *
 * Um backup que falha não pode derrubar o app nem atrapalhar o atendimento —
 * pendrive cheio, pasta do Drive fora do ar. Fica registrado no log e a tela
 * de Configurações mostra a data do último que deu certo.
 */
export async function backupSeguro(caminhos: CaminhosApp, motivo: string): Promise<boolean> {
  if (rodando) {
    log.info(`[backup] ${motivo}: já existe um backup em andamento, pulando`);
    return false;
  }

  rodando = true;
  try {
    const resultado = await fazerBackup(caminhos, pastaConfigurada());
    log.info(`[backup] ${motivo}: ok (${resultado.midiasNovas} mídia(s) nova(s))`);
    return true;
  } catch (erro) {
    log.error(`[backup] ${motivo}: falhou`, erro);
    return false;
  } finally {
    rodando = false;
  }
}

/**
 * Liga o backup automático.
 *
 * Na inicialização só roda se o último tiver mais de 24h — abrir e fechar o
 * sistema várias vezes no mesmo dia não pode gerar uma pilha de backups.
 * Depois, de 24 em 24h enquanto o app estiver de pé, que no dia a dia da
 * oficina é o tempo todo, já que ele vive na bandeja.
 */
export function agendarBackups(caminhos: CaminhosApp): void {
  const indice = lerIndice(caminhos.backups);

  if (precisaDeBackup(indice)) {
    log.info('[backup] último backup tem mais de 24h; agendando para daqui a pouco');
    timerBoot = setTimeout(() => void backupSeguro(caminhos, 'inicialização'), ATRASO_NO_BOOT_MS);
  } else {
    log.info(`[backup] último backup em ${indice.ultimoBackupEm}; nada a fazer agora`);
  }

  timerDiario = setInterval(() => void backupSeguro(caminhos, 'diário'), UM_DIA_MS);
}

export function pararBackups(): void {
  if (timerDiario) clearInterval(timerDiario);
  if (timerBoot) clearTimeout(timerBoot);
  timerDiario = null;
  timerBoot = null;
}
