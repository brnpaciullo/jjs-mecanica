import { join } from 'node:path';
import { Menu, Tray, app, nativeImage } from 'electron';
import { log } from './log.js';
import { mostrarJanela } from './janela.js';

let bandeja: Tray | null = null;

/**
 * Fechar a janela no X nao encerra o sistema: o WhatsApp e o servidor da LAN
 * precisam continuar de pe para o mecanico usar o celular. Sair de verdade so
 * pelo menu da bandeja.
 */
export function criarBandeja(aoSair: () => void): Tray {
  const caminhoIcone = join(__dirname, '..', '..', 'recursos', 'bandeja.png');
  const icone = nativeImage.createFromPath(caminhoIcone);

  bandeja = new Tray(icone.isEmpty() ? nativeImage.createEmpty() : icone);
  bandeja.setToolTip(`JJS Mecânica ${app.getVersion()}`);

  const menu = Menu.buildFromTemplate([
    { label: 'Abrir JJS Mecânica', click: () => mostrarJanela() },
    { type: 'separator' },
    {
      label: 'Sair do sistema',
      click: () => {
        log.info('[bandeja] saída pedida pelo menu da bandeja');
        aoSair();
      },
    },
  ]);

  bandeja.setContextMenu(menu);
  bandeja.on('double-click', () => mostrarJanela());

  log.info('[bandeja] criada');
  return bandeja;
}

export function destruirBandeja(): void {
  bandeja?.destroy();
  bandeja = null;
}
