import { readFileSync } from 'node:fs';
import { shell } from 'electron';
import { formatarDinheiro, formatarNumeroOs, formatarPlaca, paraWhatsApp } from '@jjs/core';
import {
  mensagens,
  reposConfig,
  reposItens,
  reposOrdens,
  reposVeiculos,
  reposClientes,
  reposEventos,
} from '@jjs/db';
import { obterBanco, obterUsuarioPadrao } from '../banco.js';
import type { CaminhosApp } from '../caminhos.js';
import { gerarPdf } from '../pdf.js';
import { abrirPasta } from '../platform/index.js';
import { videosParaOCliente } from '../midias/consultar.js';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { log } from '../log.js';
import { exigirSocket, filaDoWhatsApp, lerEstadoWhatsApp } from './conexao.js';
import { ErroDeDestino, escolherJid } from './destino.js';

/**
 * Descobre o destino real perguntando ao servidor do WhatsApp.
 *
 * Nunca montar `numero@s.whatsapp.net` na mão: no Brasil muita conta está
 * registrada sem o nono dígito, e o envio para um JID inexistente é aceito sem
 * erro — a mensagem só não chega. Ver destino.ts.
 */
async function resolverDestino(telefone: string): Promise<string> {
  const numero = paraWhatsApp(telefone);
  const resposta = await exigirSocket().onWhatsApp(numero);
  return escolherJid(resposta, telefone);
}

export type TipoMensagem = 'orcamento' | 'pronto' | 'avulsa';

export interface ResultadoEnvio {
  status: 'enviada' | 'fallback_link';
  /** Quando cai no plano B, o link para abrir o WhatsApp Web. */
  link?: string;
  /** Caminho do PDF gerado, quando houve. */
  pdf?: string;
  mensagem: string;
}

function contexto() {
  return { db: obterBanco(), usuarioId: obterUsuarioPadrao() };
}

/** Junta tudo que as variáveis do modelo precisam. */
function dadosDaOrdem(ordemId: number) {
  const ctx = contexto();
  const ordem = reposOrdens.buscarOrdem(ctx, ordemId);
  if (!ordem) throw new Error('Essa OS não foi encontrada.');

  const cliente = reposClientes.buscarCliente(ctx, ordem.clienteId);
  const veiculo = reposVeiculos.buscarVeiculo(ctx, ordem.veiculoId);
  if (!cliente || !veiculo) throw new Error('O cliente ou o carro dessa OS não foi encontrado.');

  const totais = reposItens.totaisDaOrdem(ctx, ordemId);
  const config = reposConfig.lerConfig(ctx);

  return { ctx, ordem, cliente, veiculo, totais, config };
}

function montarTexto(
  modelo: string | null,
  padrao: string,
  dados: ReturnType<typeof dadosDaOrdem>,
) {
  return reposConfig.aplicarVariaveis(modelo ?? padrao, {
    cliente: dados.cliente.nome,
    veiculo: `${dados.veiculo.marca} ${dados.veiculo.modelo}`,
    placa: formatarPlaca(dados.veiculo.placa),
    numero_os: formatarNumeroOs(dados.ordem.numero),
    total: formatarDinheiro(dados.totais.totalCentavos),
  });
}

function registrar(
  ordemId: number,
  clienteId: number,
  tipo: TipoMensagem,
  conteudo: string,
  status: 'enviada' | 'falhou' | 'fallback_link',
  anexos: string[] = [],
  erro?: string,
): void {
  contexto()
    .db.insert(mensagens)
    .values({ ordemId, clienteId, tipo, conteudo, anexos, status, erro: erro ?? null })
    .run();
}

/**
 * Plano B quando o WhatsApp está desconectado: abre o WhatsApp Web já com a
 * mensagem escrita e, se houver PDF, abre a pasta dele para a secretária
 * arrastar o arquivo na conversa. Não é automático de propósito — arquivo não
 * dá para pré-anexar por link.
 */
async function fallbackLink(
  telefone: string,
  texto: string,
  pdf: string | null,
  caminhos: CaminhosApp,
): Promise<ResultadoEnvio> {
  const link = `https://wa.me/${paraWhatsApp(telefone)}?text=${encodeURIComponent(texto)}`;
  await shell.openExternal(link);
  if (pdf) await abrirPasta(caminhos.pdfs);

  return {
    status: 'fallback_link',
    link,
    ...(pdf ? { pdf } : {}),
    mensagem: pdf
      ? 'O WhatsApp do sistema está desconectado. Abri o WhatsApp Web com a mensagem pronta e a pasta do PDF — é só arrastar o arquivo para a conversa.'
      : 'O WhatsApp do sistema está desconectado. Abri o WhatsApp Web com a mensagem pronta.',
  };
}

/**
 * Envia o orçamento: primeiro o texto, depois o PDF como documento.
 *
 * Os vídeos marcados para o cliente entram na etapa 7, quando existirem mídias;
 * as fotos marcadas já vão dentro do próprio PDF.
 *
 * Ao concluir, a OS avança para "Aguardando cliente" se ainda estiver antes
 * disso — é o que mantém o quadro fiel ao que de fato aconteceu.
 */
export async function enviarOrcamento(
  ordemId: number,
  caminhos: CaminhosApp,
): Promise<ResultadoEnvio> {
  const dados = dadosDaOrdem(ordemId);
  const texto = montarTexto(dados.config.templateMsgOrcamento, '', dados);

  const pdf = await gerarPdf(ordemId, caminhos);

  if (lerEstadoWhatsApp().situacao !== 'conectado') {
    const r = await fallbackLink(dados.cliente.telefone, texto, pdf.caminho, caminhos);
    registrar(ordemId, dados.cliente.id, 'orcamento', texto, 'fallback_link', [pdf.caminho]);
    avancarParaAguardando(ordemId);
    return r;
  }

  try {
    const destino = await resolverDestino(dados.cliente.telefone);

    // Sempre pela fila: nada sai em rajada, nem quando o balcão clica rápido.
    await filaDoWhatsApp().enfileirar(() => exigirSocket().sendMessage(destino, { text: texto }));

    await filaDoWhatsApp().enfileirar(() =>
      exigirSocket().sendMessage(destino, {
        document: readFileSync(pdf.caminho),
        mimetype: 'application/pdf',
        fileName: pdf.nomeArquivo,
      }),
    );

    // Vídeos marcados vão soltos, depois do PDF: vídeo não cabe dentro de um
    // documento, e é justamente o que mostra o barulho ou a folga da peça.
    // As fotos marcadas já foram dentro do orçamento.
    const enviados = await enviarVideosMarcados(dados.ctx, ordemId, destino, caminhos);

    registrar(ordemId, dados.cliente.id, 'orcamento', texto, 'enviada', [pdf.caminho, ...enviados]);
    reposEventos.registrarEvento(dados.ctx, {
      ordemId,
      tipo: 'mensagem',
      descricao: `Enviou o ${pdf.titulo.toLowerCase()} no WhatsApp`,
    });
    avancarParaAguardando(ordemId);

    log.info(
      `[whatsapp] orçamento da OS ${dados.ordem.numero} enviado` +
        (enviados.length > 0 ? ` com ${enviados.length} vídeo(s)` : ''),
    );
    return {
      status: 'enviada',
      pdf: pdf.caminho,
      mensagem:
        enviados.length > 0
          ? `Orçamento e ${enviados.length} vídeo(s) enviados no WhatsApp.`
          : 'Orçamento enviado no WhatsApp.',
    };
  } catch (erro) {
    registrar(ordemId, dados.cliente.id, 'orcamento', texto, 'falhou', [pdf.caminho], String(erro));
    log.error('[whatsapp] falhou ao enviar o orçamento', erro);
    return fallbackLink(dados.cliente.telefone, texto, pdf.caminho, caminhos);
  }
}

/** Avisa que o carro está pronto para retirada. */
export async function avisarPronto(
  ordemId: number,
  caminhos: CaminhosApp,
): Promise<ResultadoEnvio> {
  const dados = dadosDaOrdem(ordemId);
  const texto = montarTexto(dados.config.templateMsgPronto, '', dados);

  if (lerEstadoWhatsApp().situacao !== 'conectado') {
    const r = await fallbackLink(dados.cliente.telefone, texto, null, caminhos);
    registrar(ordemId, dados.cliente.id, 'pronto', texto, 'fallback_link');
    return r;
  }

  try {
    const destino = await resolverDestino(dados.cliente.telefone);
    await filaDoWhatsApp().enfileirar(() => exigirSocket().sendMessage(destino, { text: texto }));
    registrar(ordemId, dados.cliente.id, 'pronto', texto, 'enviada');
    reposEventos.registrarEvento(dados.ctx, {
      ordemId,
      tipo: 'mensagem',
      descricao: 'Avisou o cliente que o carro está pronto',
    });
    return { status: 'enviada', mensagem: 'Cliente avisado no WhatsApp.' };
  } catch (erro) {
    registrar(ordemId, dados.cliente.id, 'pronto', texto, 'falhou', [], String(erro));
    if (erro instanceof ErroDeDestino) throw erro;
    return fallbackLink(dados.cliente.telefone, texto, null, caminhos);
  }
}

/** Mensagem de teste para conferir a conexão, sem envolver nenhuma OS. */
export async function enviarTeste(telefone: string): Promise<ResultadoEnvio> {
  const destino = await resolverDestino(telefone);
  const texto = 'Mensagem de teste do sistema da JJS Mecânica. Se você recebeu, está tudo certo.';

  await filaDoWhatsApp().enfileirar(() => exigirSocket().sendMessage(destino, { text: texto }));
  log.info(`[whatsapp] teste enviado para ${destino}`);
  return {
    status: 'enviada',
    mensagem: `Mensagem de teste enviada para ${destino.split('@')[0]}.`,
  };
}

/**
 * Manda os vídeos marcados como "enviar ao cliente".
 *
 * Cada um passa pela fila, respeitando o intervalo mínimo — mandar três vídeos
 * em rajada é exatamente o comportamento que faz o WhatsApp derrubar o número.
 * Um vídeo que falha não impede os outros nem desfaz o envio do orçamento.
 */
async function enviarVideosMarcados(
  ctx: ReturnType<typeof contexto>,
  ordemId: number,
  destino: string,
  caminhos: CaminhosApp,
): Promise<string[]> {
  const enviados: string[] = [];

  for (const video of videosParaOCliente(ctx, ordemId)) {
    const caminho = join(caminhos.midias, video.arquivoPath);
    if (!existsSync(caminho)) {
      log.warn(`[whatsapp] vídeo marcado não está no disco: ${caminho}`);
      continue;
    }

    try {
      await filaDoWhatsApp().enfileirar(() =>
        exigirSocket().sendMessage(destino, {
          video: readFileSync(caminho),
          mimetype: 'video/mp4',
          caption: video.legenda ?? undefined,
        }),
      );
      enviados.push(caminho);
    } catch (erro) {
      log.error(`[whatsapp] falhou ao enviar o vídeo ${video.id}`, erro);
    }
  }

  return enviados;
}

function avancarParaAguardando(ordemId: number): void {
  const ctx = contexto();
  const ordem = reposOrdens.buscarOrdem(ctx, ordemId);
  if (!ordem) return;

  const antesDoEnvio = ['recepcao', 'diagnostico'];
  if (antesDoEnvio.includes(ordem.status)) {
    reposOrdens.mudarStatus(ctx, ordemId, 'orcamento_enviado');
  }
}
