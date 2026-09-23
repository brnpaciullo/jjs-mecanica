import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { app, BrowserWindow } from 'electron';
import { montarCaminhos, garantirPastas } from './caminhos.js';
import { configurarLog, log } from './log.js';
import { iniciarBanco, fecharBanco } from './banco.js';
import { criarJanela, mostrarJanela, obterJanela } from './janela.js';
import { criarBandeja, destruirBandeja } from './bandeja.js';
import { registrarCanais } from './ipc/canais.js';
import { encerrarWhatsApp, iniciarWhatsApp } from './whatsapp/conexao.js';
import { agendarBackups, pararBackups } from './backup/agenda.js';
import { iniciarAtualizacoes, pararAtualizacoes } from './atualizacao.js';

/**
 * Fixa o nome antes de qualquer app.getPath('userData').
 *
 * Sem isto o Electron monta a pasta de dados a partir do nome do pacote, e ela
 * sairia como "@jjs/desktop" em dev e "JJS Mecanica" empacotado: dois lugares
 * diferentes, um deles com espaco e acento no caminho do Windows.
 *
 * **Dev e producao usam pastas separadas de proposito.** Quando os dois
 * compartilhavam a mesma pasta, rodar `npm run dev` na maquina de quem
 * desenvolve mexia no banco real e na sessao do WhatsApp da oficina: um teste
 * de migracao podia corromper dados de cliente, e testar "desconectar" tirava
 * o numero da oficina do ar. O app instalado fica em jjs-mecanica; o de
 * desenvolvimento, em jjs-mecanica-dev.
 */
app.setName(app.isPackaged ? 'jjs-mecanica' : 'jjs-mecanica-dev');

/**
 * Instancia unica. Duas copias abertas no mesmo notebook brigariam pelo banco,
 * pela sessao do WhatsApp e pela porta da rede. A segunda so traz a primeira
 * para a frente.
 */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  iniciar();
}

/** Diferencia "fechar a janela" (esconde) de "sair do sistema" (encerra). */
let encerrando = false;

function iniciar(): void {
  const caminhos = montarCaminhos();
  garantirPastas(caminhos);
  configurarLog(caminhos.logs);

  app.on('second-instance', () => {
    log.info('[app] segunda instância bloqueada, trazendo a janela para a frente');
    mostrarJanela();
  });

  app.whenReady().then(() => {
    // O banco precisa estar migrado antes de qualquer tela abrir.
    iniciarBanco(caminhos);
    registrarCanais(caminhos);

    // --minimizado e o argumento usado quando o Windows sobe o app no login.
    const comecarEscondido = process.argv.includes('--minimizado');
    const janela = criarJanela(!comecarEscondido);

    janela.on('close', (evento) => {
      if (encerrando) return;
      // Fechar no X mantém o WhatsApp e o servidor da LAN de pé.
      evento.preventDefault();
      janela.hide();
      log.info('[app] janela escondida na bandeja');
    });

    criarBandeja(sairDeVerdade);

    // Reconecta sozinho só se a oficina já pareou o celular alguma vez. Sem
    // sessão salva, ficar chamando o Baileys geraria um QR que ninguém pediu.
    if (existsSync(join(caminhos.whatsappSession, 'creds.json'))) {
      log.info('[app] sessão do WhatsApp encontrada, reconectando');
      void iniciarWhatsApp(caminhos).catch((erro) =>
        log.error('[app] não consegui reconectar o WhatsApp', erro),
      );
    } else {
      log.info('[app] sem sessão do WhatsApp; aguardando o QR em Configurações');
    }

    agendarBackups(caminhos);
    iniciarAtualizacoes(caminhos);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) criarJanela(true);
    });

    log.info('[app] pronto');
  });

  // Sem listener, o padrão do Electron é encerrar o app quando a última janela
  // fecha. Aqui isso seria um defeito: o sistema vive na bandeja, e as janelas
  // ocultas que geram PDF são criadas e destruídas o tempo todo. Só o menu da
  // bandeja encerra de verdade.
  app.on('window-all-closed', () => {
    if (encerrando) app.quit();
  });

  app.on('before-quit', () => {
    encerrando = true;
  });

  app.on('will-quit', () => {
    pararAtualizacoes();
    pararBackups();
    encerrarWhatsApp();
    destruirBandeja();
    fecharBanco();
    log.info('[app] encerrado');
  });
}

function sairDeVerdade(): void {
  encerrando = true;
  obterJanela()?.destroy();
  app.quit();
}
