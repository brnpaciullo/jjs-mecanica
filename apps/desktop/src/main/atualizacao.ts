import { app } from 'electron';
import pkg from 'electron-updater';
import type { CaminhosApp } from './caminhos.js';
import { log } from './log.js';
import { backupSeguro } from './backup/agenda.js';
import { obterJanela } from './janela.js';

/**
 * `autoUpdater` é um **getter preguiçoso**: ele só constrói o atualizador da
 * plataforma no primeiro acesso, e essa construção exige o contexto do
 * Electron. Desestruturar no topo do módulo construiria um atualizador de
 * Linux durante o desenvolvimento, sem nenhuma necessidade — por isso o acesso
 * fica dentro desta função, chamada só quando o app está empacotado.
 */
function updater() {
  return pkg.autoUpdater;
}

const A_CADA_6H_MS = 6 * 60 * 60 * 1000;

export type SituacaoAtualizacao =
  'ociosa' | 'procurando' | 'em_dia' | 'baixando' | 'pronta' | 'erro';

export interface EstadoAtualizacao {
  situacao: SituacaoAtualizacao;
  versaoInstalada: string;
  versaoNova: string | null;
  /** 0 a 100 enquanto baixa. */
  progresso: number;
  /** Mensagem em português dizendo o que está acontecendo ou o que fazer. */
  aviso: string | null;
}

let estado: EstadoAtualizacao = {
  situacao: 'ociosa',
  versaoInstalada: app.getVersion(),
  versaoNova: null,
  progresso: 0,
  aviso: null,
};

let caminhosApp: CaminhosApp | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function avisar(mudanca: Partial<EstadoAtualizacao>): void {
  estado = { ...estado, ...mudanca };
  const janela = obterJanela();
  if (janela && !janela.isDestroyed()) janela.webContents.send('atualizacao:mudou', estado);
}

export function lerEstadoAtualizacao(): EstadoAtualizacao {
  return estado;
}

/**
 * Liga o auto-update.
 *
 * O download é automático, mas a **instalação nunca**: trocar o programa no
 * meio de um atendimento fecharia a tela na cara de quem está com o cliente na
 * frente. O app avisa que a versão está pronta e espera o balcão escolher a
 * hora.
 */
export function iniciarAtualizacoes(caminhos: CaminhosApp): void {
  caminhosApp = caminhos;

  if (!app.isPackaged) {
    log.info('[update] modo desenvolvimento: verificação desligada');
    avisar({ situacao: 'ociosa', aviso: null });
    return;
  }

  const atualizador = updater();
  atualizador.logger = log;
  atualizador.autoDownload = true;
  // Quem decide quando reiniciar é a pessoa, não o instalador.
  atualizador.autoInstallOnAppQuit = false;

  atualizador.on('checking-for-update', () => avisar({ situacao: 'procurando', aviso: null }));

  atualizador.on('update-not-available', () =>
    avisar({ situacao: 'em_dia', versaoNova: null, aviso: null }),
  );

  atualizador.on('update-available', (info) => {
    log.info(`[update] versão ${info.version} disponível`);
    avisar({ situacao: 'baixando', versaoNova: info.version, progresso: 0, aviso: null });
  });

  atualizador.on('download-progress', (p) =>
    avisar({ situacao: 'baixando', progresso: Math.round(p.percent) }),
  );

  atualizador.on('update-downloaded', (info) => {
    log.info(`[update] versão ${info.version} baixada e pronta`);
    avisar({ situacao: 'pronta', versaoNova: info.version, progresso: 100, aviso: null });
  });

  atualizador.on('error', (erro) => {
    log.error('[update] falhou', erro);
    avisar({
      situacao: 'erro',
      aviso:
        'Não consegui verificar se existe versão nova. ' +
        'Pode ser falta de internet — o sistema continua funcionando normalmente.',
    });
  });

  void procurarAtualizacao();
  timer = setInterval(() => void procurarAtualizacao(), A_CADA_6H_MS);
}

export async function procurarAtualizacao(): Promise<EstadoAtualizacao> {
  if (!app.isPackaged) {
    avisar({
      situacao: 'em_dia',
      aviso: 'A atualização automática só funciona no aplicativo instalado.',
    });
    return estado;
  }

  try {
    await updater().checkForUpdates();
  } catch (erro) {
    log.error('[update] verificação falhou', erro);
  }
  return estado;
}

/**
 * Aplica a atualização baixada.
 *
 * **Faz backup antes, obrigatoriamente.** A nova versão pode trazer migrações
 * de banco, e migração é justamente o momento em que dados se perdem. Se o
 * backup falhar, a atualização não acontece: é melhor ficar uma versão atrás
 * do que arriscar o histórico da oficina.
 */
export async function aplicarAtualizacao(): Promise<void> {
  if (estado.situacao !== 'pronta') {
    throw new Error('Ainda não há uma versão nova baixada para instalar.');
  }
  if (!caminhosApp) throw new Error('O sistema ainda está iniciando. Tente daqui a pouco.');

  log.info('[update] backup obrigatório antes de instalar');
  const deuCerto = await backupSeguro(caminhosApp, 'antes da atualização');

  if (!deuCerto) {
    throw new Error(
      'Não consegui fazer o backup antes de atualizar, então não vou instalar agora. ' +
        'Confira a pasta de backup em Configurações e tente de novo.',
    );
  }

  log.info('[update] instalando e reiniciando');
  // O segundo `true` faz o app subir de novo depois de instalar.
  updater().quitAndInstall(false, true);
}

export function pararAtualizacoes(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
