import { rmSync } from 'node:fs';
/**
 * `makeWASocket` vem pelo **import nomeado**, nunca pelo default.
 *
 * O bundle do processo main é CJS, e o esbuild converte `import x from 'pkg'`
 * com a semântica do Node (`isNodeMode`): o default vira o `module.exports`
 * inteiro, e não a função. Como aqui o default É a função, o resultado era um
 * objeto e o app estourava "makeWASocket is not a function" na hora de gerar o
 * QR. Com o import nomeado isso não acontece.
 */
import {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeWASocket,
  useMultiFileAuthState,
  type WASocket,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import type { CaminhosApp } from '../caminhos.js';
import { log } from '../log.js';
import { FilaDeEnvio } from './fila.js';
import { ESTADO_INICIAL, type EstadoWhatsApp } from './estado.js';

/** Intervalo mínimo entre mensagens. Menos que isso vira rajada e derruba o número. */
const INTERVALO_ENTRE_ENVIOS_MS = 3000;

const RECONEXAO_MIN_MS = 2000;
const RECONEXAO_MAX_MS = 60_000;

type Ouvinte = (estado: EstadoWhatsApp) => void;

let socket: WASocket | null = null;
let estado: EstadoWhatsApp = { ...ESTADO_INICIAL };
let caminhos: CaminhosApp | null = null;
let ouvintes: Ouvinte[] = [];
let tentativas = 0;
let timerReconexao: ReturnType<typeof setTimeout> | null = null;
/** Verdadeiro quando o usuário mandou desconectar: aí não reconecta sozinho. */
let desligadoDeProposito = false;

const fila = new FilaDeEnvio(INTERVALO_ENTRE_ENVIOS_MS, (tamanho) =>
  atualizar({ naFila: tamanho }),
);

function atualizar(mudanca: Partial<EstadoWhatsApp>): void {
  estado = { ...estado, ...mudanca };
  for (const ouvinte of ouvintes) ouvinte(estado);
}

export function observarWhatsApp(ouvinte: Ouvinte): () => void {
  ouvintes.push(ouvinte);
  ouvinte(estado);
  return () => {
    ouvintes = ouvintes.filter((o) => o !== ouvinte);
  };
}

export function lerEstadoWhatsApp(): EstadoWhatsApp {
  return estado;
}

/** Só existe socket utilizável quando a conexão está aberta. */
export function exigirSocket(): WASocket {
  if (!socket || estado.situacao !== 'conectado') {
    throw new Error(
      'O WhatsApp está desconectado. Vá em Configurações > WhatsApp e leia o QR code.',
    );
  }
  return socket;
}

export function filaDoWhatsApp(): FilaDeEnvio {
  return fila;
}

/**
 * Sobe a conexão com o WhatsApp.
 *
 * A sessão fica em `userData/whatsapp-session`: uma vez pareado, o celular do
 * dono não precisa ler o QR de novo. Quedas de rede reconectam sozinhas com
 * espera crescente; só "sair do WhatsApp" pelo celular ou o botão Desconectar
 * exigem parear de novo.
 */
export async function iniciarWhatsApp(caminhosApp: CaminhosApp): Promise<void> {
  caminhos = caminhosApp;
  desligadoDeProposito = false;

  if (socket) {
    log.info('[whatsapp] já existe uma conexão em andamento');
    return;
  }

  atualizar({ situacao: 'conectando', aviso: null });

  const { state, saveCreds } = await useMultiFileAuthState(caminhos.whatsappSession);
  const { version } = await fetchLatestBaileysVersion();
  log.info(`[whatsapp] protocolo ${version.join('.')}`);

  socket = makeWASocket({
    version,
    auth: state,
    // O QR é desenhado na tela de Configurações, não no terminal.
    printQRInTerminal: false,
    // Marcar online faria o celular do dono parar de receber notificação.
    markOnlineOnConnect: false,
    syncFullHistory: false,
    logger: registradorSilencioso(),
  });

  socket.ev.on('creds.update', saveCreds);

  socket.ev.on('connection.update', (atualizacao) => {
    const { connection, lastDisconnect, qr } = atualizacao;

    if (qr) {
      QRCode.toDataURL(qr, { margin: 1, width: 320 })
        .then((dataUri) => atualizar({ situacao: 'lendo_qr', qrDataUri: dataUri, aviso: null }))
        .catch((erro: unknown) => log.error('[whatsapp] falhou ao desenhar o QR', erro));
    }

    if (connection === 'open') {
      tentativas = 0;
      const eu = socket?.user;
      atualizar({
        situacao: 'conectado',
        qrDataUri: null,
        numero: eu?.id ? eu.id.split(':')[0]!.split('@')[0]! : null,
        nome: eu?.name ?? null,
        aviso: null,
      });
      log.info(`[whatsapp] conectado como ${estado.numero ?? '?'}`);
    }

    if (connection === 'close') {
      const codigo =
        (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output
          ?.statusCode ?? 0;
      tratarQueda(codigo);
    }
  });
}

function tratarQueda(codigo: number): void {
  socket = null;

  if (desligadoDeProposito) {
    atualizar({ situacao: 'desconectado', qrDataUri: null, numero: null, nome: null });
    return;
  }

  // Sessão encerrada no celular: não adianta reconectar, precisa parear de novo.
  if (codigo === DisconnectReason.loggedOut || codigo === DisconnectReason.forbidden) {
    log.warn('[whatsapp] sessão encerrada no celular');
    limparSessao();
    atualizar({
      situacao: 'desconectado',
      qrDataUri: null,
      numero: null,
      nome: null,
      aviso:
        'O WhatsApp foi desconectado pelo celular. Vá em Configurações > WhatsApp e leia o QR code de novo.',
    });
    return;
  }

  // O 515 é normal logo depois de parear: o servidor pede para reabrir.
  const reinicioEsperado = codigo === DisconnectReason.restartRequired;
  tentativas = reinicioEsperado ? 0 : tentativas + 1;

  const espera = reinicioEsperado
    ? RECONEXAO_MIN_MS
    : Math.min(RECONEXAO_MIN_MS * 2 ** (tentativas - 1), RECONEXAO_MAX_MS);

  log.info(`[whatsapp] queda (código ${codigo}); reconectando em ${Math.round(espera / 1000)}s`);
  atualizar({
    situacao: 'conectando',
    qrDataUri: null,
    aviso: reinicioEsperado ? null : 'Conexão caiu. Tentando de novo...',
  });

  if (timerReconexao) clearTimeout(timerReconexao);
  timerReconexao = setTimeout(() => {
    if (caminhos) void iniciarWhatsApp(caminhos).catch((e) => log.error('[whatsapp]', e));
  }, espera);
}

/** Desconecta a pedido do usuário e apaga a sessão pareada. */
export async function desconectarWhatsApp(): Promise<void> {
  desligadoDeProposito = true;
  if (timerReconexao) clearTimeout(timerReconexao);

  try {
    await socket?.logout();
  } catch (erro) {
    log.warn('[whatsapp] logout não completou; apagando a sessão local mesmo assim', erro);
  }

  socket = null;
  limparSessao();
  atualizar({ ...ESTADO_INICIAL, aviso: null });
  log.info('[whatsapp] desconectado pelo usuário');
}

function limparSessao(): void {
  if (!caminhos) return;
  rmSync(caminhos.whatsappSession, { recursive: true, force: true });
}

export function encerrarWhatsApp(): void {
  if (timerReconexao) clearTimeout(timerReconexao);
  try {
    socket?.end(undefined);
  } catch {
    // Encerrando o app: não há o que fazer com erro aqui.
  }
  socket = null;
}

/** O Baileys fala muito; o que interessa já é registrado por este módulo. */
function registradorSilencioso() {
  const nada = () => {};
  const logger = {
    level: 'silent',
    trace: nada,
    debug: nada,
    info: nada,
    warn: nada,
    error: nada,
    fatal: nada,
    child: () => logger,
  };
  return logger as unknown as Parameters<typeof makeWASocket>[0]['logger'];
}
