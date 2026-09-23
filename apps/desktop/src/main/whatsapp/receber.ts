import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Notification } from 'electron';
import { downloadMediaMessage, type WAMessage, type WASocket } from '@whiskeysockets/baileys';
import { reposConfig, reposEventos } from '@jjs/db';
import { obterBanco, obterUsuarioPadrao } from '../banco.js';
import type { CaminhosApp } from '../caminhos.js';
import { log } from '../log.js';
import { salvarFoto, salvarVideo } from '../midias/processar.js';
import { mostrarJanela } from '../janela.js';
import { acharOrdemPelaLegenda, legendaHerdada, lembrarLegenda } from './vincular.js';

/**
 * Atalho do mecânico: mandar a foto no WhatsApp.
 *
 * É o caminho de menor atrito que existe — o mecânico já está com o WhatsApp
 * aberto e sujo de graxa. O sistema escuta **um lugar só** e recolhe o que
 * aparece ali. Fora dele nada é tocado: as conversas com clientes ficam
 * intactas.
 *
 * Esse lugar é o **grupo escolhido em Configurações**, quando há um. É o modo
 * bom: qualquer número dentro do grupo serve, então cada mecânico manda do
 * celular dele e ninguém precisa carregar o WhatsApp da oficina.
 *
 * Sem grupo escolhido, vale o **chat da oficina consigo mesma** — que só
 * funciona para quem estiver com o número da oficina em mãos. Os dois nunca
 * valem ao mesmo tempo: escolher um grupo troca a fonte, não soma outra.
 */
export function escutarMidiasDoWhatsApp(socket: WASocket, caminhos: CaminhosApp): void {
  socket.ev.on('messages.upsert', ({ messages, type }) => {
    // 'notify' é mensagem chegando agora; 'append' é sincronização de
    // histórico e traria fotos antigas de novo a cada reconexão.
    if (type !== 'notify') return;

    for (const mensagem of messages) {
      void tratar(socket, caminhos, mensagem).catch((erro) =>
        log.error('[whatsapp] falhou ao receber a mídia', erro),
      );
    }
  });

  const grupo = grupoEscolhido();
  log.info(
    grupo
      ? `[whatsapp] escutando mídias do grupo ${grupo}`
      : '[whatsapp] escutando mídias do chat consigo mesmo (nenhum grupo escolhido)',
  );
}

/** O grupo escolhido em Configurações, ou null se ninguém escolheu. */
function grupoEscolhido(): string | null {
  try {
    return reposConfig.lerConfig({ db: obterBanco(), usuarioId: null }).whatsappGrupoJid;
  } catch (erro) {
    log.error('[whatsapp] não consegui ler o grupo configurado', erro);
    return null;
  }
}

/**
 * A mídia veio do lugar que a oficina mandou escutar?
 *
 * Recebe o grupo por parâmetro em vez de ler a config aqui dentro: assim a
 * decisão é uma função pura, e o teste consegue exercitar as duas fontes sem
 * precisar de banco nem de WhatsApp.
 */
export function ehDaFonteCerta(socket: WASocket, mensagem: WAMessage, grupo: string | null): boolean {
  // Com grupo escolhido, qualquer participante serve — inclusive a própria
  // oficina. É justamente isso que faz o atalho servir ao celular do mecânico.
  if (grupo) return mensagem.key.remoteJid === grupo;
  return ehChatConsigoMesmo(socket, mensagem);
}

/**
 * Quem mandou. Num grupo é o participante; no chat consigo mesmo, o próprio
 * número. Serve para a herança de legenda não misturar dois mecânicos.
 */
export function remetenteDe(mensagem: WAMessage): string {
  const bruto = mensagem.key.participant ?? mensagem.key.remoteJid ?? 'desconhecido';
  return bruto.split(':')[0]!.split('@')[0]!;
}

function ehChatConsigoMesmo(socket: WASocket, mensagem: WAMessage): boolean {
  // `fromMe` sozinho não basta: mensagem que a oficina envia a um cliente
  // também é "de mim". O destino precisa ser o próprio número.
  if (!mensagem.key.fromMe) return false;

  const meu = socket.user?.id?.split(':')[0]?.split('@')[0];
  const destino = mensagem.key.remoteJid?.split('@')[0]?.split(':')[0];
  return Boolean(meu && destino && meu === destino);
}

async function tratar(socket: WASocket, caminhos: CaminhosApp, mensagem: WAMessage): Promise<void> {
  if (!ehDaFonteCerta(socket, mensagem, grupoEscolhido())) return;

  const conteudo = mensagem.message;
  const imagem = conteudo?.imageMessage;
  const video = conteudo?.videoMessage;
  if (!imagem && !video) return;

  const legendaCrua = (imagem?.caption ?? video?.caption ?? '').trim();
  const remetente = remetenteDe(mensagem);
  const ctx = { db: obterBanco(), usuarioId: obterUsuarioPadrao() };

  // Sem legenda, herda a da mídia anterior: quem manda cinco fotos do mesmo
  // serviço escreve o texto só na primeira.
  let legenda = legendaCrua;
  let vinculo = legendaCrua ? acharOrdemPelaLegenda(ctx, legendaCrua) : null;

  if (!legendaCrua) {
    const herdada = legendaHerdada(remetente);
    if (herdada) {
      legenda = herdada.legenda;
      vinculo = herdada.vinculo;
      log.info(`[whatsapp] mídia sem legenda herdou "${legenda}"`);
    }
  } else {
    lembrarLegenda(remetente, legendaCrua, vinculo);
  }

  const bytes = (await downloadMediaMessage(mensagem, 'buffer', {})) as Buffer;
  const ordemId = vinculo?.ordemId ?? null;

  if (imagem) {
    await salvarFoto(caminhos, ordemId, bytes, {
      momento: 'servico',
      legenda: legenda || null,
      origem: 'whatsapp',
      criadoPor: obterUsuarioPadrao(),
    });
  } else {
    // salvarVideo move o arquivo; o download vem em memória, então grava antes.
    const temporario = join(tmpdir(), `jjs-wa-${Date.now()}.mp4`);
    writeFileSync(temporario, bytes);
    await salvarVideo(caminhos, ordemId, temporario, {
      momento: 'servico',
      legenda: legenda || null,
      origem: 'whatsapp',
      criadoPor: obterUsuarioPadrao(),
    });
  }

  const tipo = imagem ? 'Foto' : 'Vídeo';

  if (vinculo) {
    reposEventos.registrarEvento(ctx, {
      ordemId: vinculo.ordemId,
      tipo: 'midia',
      descricao: `${tipo} recebida pelo WhatsApp (${vinculo.por === 'placa' ? 'pela placa' : 'pelo número da OS'})`,
    });
    log.info(`[whatsapp] ${tipo} anexada à OS ${vinculo.numero}`);
    return;
  }

  // Sem correspondência: vai para a caixa e o balcão precisa saber, senão a
  // foto fica esquecida lá.
  log.info(`[whatsapp] ${tipo} sem OS identificada; foi para a caixa de entrada`);
  avisarNoDesktop(tipo, legendaCrua);
}

function avisarNoDesktop(tipo: string, legenda: string): void {
  if (!Notification.isSupported()) return;

  const aviso = new Notification({
    title: `${tipo} recebida sem OS`,
    body: legenda
      ? `Não reconheci "${legenda}". Está em Mídias sem OS.`
      : 'Chegou sem legenda. Está em Mídias sem OS, para anexar a uma OS.',
  });

  aviso.on('click', () => mostrarJanela());
  aviso.show();
}

/** Texto de ajuda para a tela de Configurações. */
export function comoUsarOAtalho(grupo: string | null, numero: string | null): string {
  const onde = grupo
    ? `No celular, mande a foto no grupo "${grupo}".`
    : 'No celular, abra a conversa do WhatsApp da oficina consigo mesma' +
      (numero ? ` (${numero})` : '') +
      ' e mande a foto.';

  return (
    `${onde} Escreva uma legenda como "OS 142" ou a placa do carro e ela aparece ` +
    'na OS automaticamente. Sem legenda, vai para a caixa Mídias sem OS.'
  );
}
