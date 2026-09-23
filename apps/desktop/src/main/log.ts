import { join } from 'node:path';
import { app } from 'electron';
import log from 'electron-log/main';

/**
 * Log em arquivo rotativo. E o que vai no "Exportar diagnostico" das
 * Configuracoes, para a oficina me mandar quando algo der errado.
 */
export function configurarLog(pastaLogs: string): void {
  log.initialize();

  log.transports.file.resolvePathFn = () => join(pastaLogs, 'jjs.log');
  log.transports.file.level = app.isPackaged ? 'info' : 'debug';
  log.transports.file.maxSize = 5 * 1024 * 1024;
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
  log.transports.console.level = app.isPackaged ? false : 'debug';

  log.errorHandler.startCatching({ showDialog: false });

  log.info('--------------------------------------------------');
  log.info(`JJS Mecânica ${app.getVersion()} iniciando`);
  log.info(`Electron ${process.versions.electron} / Node ${process.versions.node}`);
  log.info(`Plataforma ${process.platform} ${process.arch}`);
  // Deixa explicito de qual pasta o app esta lendo: dev e producao usam
  // pastas diferentes, e confundir as duas ja causou surpresa uma vez.
  log.info(`Modo ${app.isPackaged ? 'INSTALADO' : 'DESENVOLVIMENTO'}`);
  log.info(`Dados em ${app.getPath('userData')}`);
}

export { log };
