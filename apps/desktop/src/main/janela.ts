import { join } from 'node:path';
import { BrowserWindow, shell } from 'electron';
import { log } from './log.js';

let janela: BrowserWindow | null = null;

export function criarJanela(mostrar: boolean): BrowserWindow {
  janela = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: 'JJS Mecânica',
    backgroundColor: '#15171B',
    autoHideMenuBar: true,
    icon: join(__dirname, '..', '..', 'recursos', 'icon.png'),
    webPreferences: {
      preload: join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // O preload precisa do bridge; o renderer continua sem acesso ao Node.
      sandbox: false,
    },
  });

  // Só aparece quando a tela já está pronta, sem piscar branco.
  janela.once('ready-to-show', () => {
    if (mostrar) janela?.show();
  });

  // Link externo abre no navegador, nunca dentro do app.
  janela.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  janela.on('closed', () => {
    janela = null;
  });

  const urlDev = process.env['ELECTRON_RENDERER_URL'];
  if (urlDev) {
    void janela.loadURL(urlDev);
  } else {
    void janela.loadFile(join(__dirname, '..', 'renderer', 'index.html'));
  }

  log.info('[janela] criada');
  return janela;
}

export function obterJanela(): BrowserWindow | null {
  return janela;
}

/** Traz a janela para a frente; recria se o usuário já tiver fechado. */
export function mostrarJanela(): void {
  if (!janela || janela.isDestroyed()) {
    criarJanela(true);
    return;
  }
  if (janela.isMinimized()) janela.restore();
  janela.show();
  janela.focus();
}
