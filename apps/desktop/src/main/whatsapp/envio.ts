import { readFileSync } from 'node:fs';
import { shell } from 'electron';
import { formatarDinheiro, formatarNumeroOs, formatarPlaca, paraWhatsApp } from '@jjs/core';
import {
  TEMPLATE_RECEBIMENTO_PADRAO,
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
import { fotosParaOCliente, videosParaOCliente } from '../midias/consultar.js';
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

const TEXTO_MIDIAS_AVULSAS =
  'Olá {cliente}! Seguem as fotos e vídeos da {veiculo} placa {placa} (OS {numero_os}).';

export type TipoMensagem = 'recebimento' | 'orcamento' | 'pronto' | 'avulsa';

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

    // Fotos e vídeos marcados vão soltos, depois do PDF. O vídeo não cabe
    // dentro de um documento, e é justamente o que mostra o barulho ou a folga
    // da peça; a foto vai de novo porque no PDF ela é miniatura de impressão.
    const midias = await enviarMidiasMarcadas(dados.ctx, ordemId, destino, caminhos);
    const resumo = resumoDeMidias(midias.fotos, midias.videos);

    registrar(ordemId, dados.cliente.id, 'orcamento', texto, 'enviada', [
      pdf.caminho,
      ...midias.caminhos,
    ]);
    reposEventos.registrarEvento(dados.ctx, {
      ordemId,
      tipo: 'mensagem',
      descricao: `Enviou o ${pdf.titulo.toLowerCase()} no WhatsApp`,
    });
    avancarParaAguardando(ordemId);

    log.info(
      `[whatsapp] orçamento da OS ${dados.ordem.numero} enviado` +
        (resumo ? ` com ${resumo}` : ''),
    );
    return {
      status: 'enviada',
      pdf: pdf.caminho,
      mensagem: resumo
        ? `Orçamento e ${resumo} enviados no WhatsApp.`
        : 'Orçamento enviado no WhatsApp.',
    };
  } catch (erro) {
    registrar(ordemId, dados.cliente.id, 'orcamento', texto, 'falhou', [pdf.caminho], String(erro));
    log.error('[whatsapp] falhou ao enviar o orçamento', erro);
    return fallbackLink(dados.cliente.telefone, texto, pdf.caminho, caminhos);
  }
}

/**
 * Comprovante de entrada: confirma ao cliente que o carro chegou.
 *
 * Existe porque, antes disto, o único documento que dava para mandar era o
 * orçamento — e na recepção ele sai com a tabela vazia e total R$ 0,00, que o
 * cliente lê como "de graça". O PDF aqui é a variação `recibo_entrada`, que o
 * `variacaoPara()` escolhe sozinho enquanto a OS está em recepção ou
 * diagnóstico.
 *
 * **Não avança o status**, ao contrário do orçamento: o carro acabou de
 * entrar, e o quadro deve continuar mostrando isso.
 */
export async function enviarComprovanteEntrada(
  ordemId: number,
  caminhos: CaminhosApp,
): Promise<ResultadoEnvio> {
  const dados = dadosDaOrdem(ordemId);
  const texto = montarTexto(
    dados.config.templateMsgRecebimento,
    TEMPLATE_RECEBIMENTO_PADRAO,
    dados,
  );

  const pdf = await gerarPdf(ordemId, caminhos);

  if (lerEstadoWhatsApp().situacao !== 'conectado') {
    const r = await fallbackLink(dados.cliente.telefone, texto, pdf.caminho, caminhos);
    registrar(ordemId, dados.cliente.id, 'recebimento', texto, 'fallback_link', [pdf.caminho]);
    return r;
  }

  try {
    const destino = await resolverDestino(dados.cliente.telefone);

    await filaDoWhatsApp().enfileirar(() => exigirSocket().sendMessage(destino, { text: texto }));
    await filaDoWhatsApp().enfileirar(() =>
      exigirSocket().sendMessage(destino, {
        document: readFileSync(pdf.caminho),
        mimetype: 'application/pdf',
        fileName: pdf.nomeArquivo,
      }),
    );

    const midias = await enviarMidiasMarcadas(dados.ctx, ordemId, destino, caminhos);
    const resumo = resumoDeMidias(midias.fotos, midias.videos);

    registrar(ordemId, dados.cliente.id, 'recebimento', texto, 'enviada', [
      pdf.caminho,
      ...midias.caminhos,
    ]);
    reposEventos.registrarEvento(dados.ctx, {
      ordemId,
      tipo: 'mensagem',
      descricao: 'Enviou o comprovante de entrada no WhatsApp',
    });

    log.info(
      `[whatsapp] comprovante de entrada da OS ${dados.ordem.numero} enviado` +
        (resumo ? ` com ${resumo}` : ''),
    );
    return {
      status: 'enviada',
      pdf: pdf.caminho,
      mensagem: resumo
        ? `Comprovante de entrada e ${resumo} enviados no WhatsApp.`
        : 'Comprovante de entrada enviado no WhatsApp.',
    };
  } catch (erro) {
    registrar(ordemId, dados.cliente.id, 'recebimento', texto, 'falhou', [pdf.caminho], String(erro));
    log.error('[whatsapp] falhou ao enviar o comprovante de entrada', erro);
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

/**
 * Manda só as fotos e os vídeos marcados, sem documento.
 *
 * Serve para reenviar o que o cliente não viu, ou para mandar uma foto nova
 * que apareceu depois — sem repetir o PDF, que o cliente já tem e que tornaria
 * a conversa confusa com duas versões do mesmo orçamento.
 *
 * Vai uma linha curta antes, dizendo de que carro é: foto solta chegando sem
 * contexto na conversa do cliente não ajuda ninguém.
 */
export async function enviarMidiasDaOrdem(
  ordemId: number,
  caminhos: CaminhosApp,
): Promise<ResultadoEnvio> {
  const dados = dadosDaOrdem(ordemId);
  const texto = montarTexto(null, TEXTO_MIDIAS_AVULSAS, dados);

  const quantas =
    fotosParaOCliente(dados.ctx, ordemId).length + videosParaOCliente(dados.ctx, ordemId).length;
  if (quantas === 0) {
    throw new Error(
      'Nenhuma foto ou vídeo está marcado para o cliente. Marque em "Vai ao cliente" na galeria da OS.',
    );
  }

  if (lerEstadoWhatsApp().situacao !== 'conectado') {
    const r = await fallbackLink(dados.cliente.telefone, texto, null, caminhos);
    await abrirPasta(join(caminhos.midias, String(ordemId)));
    registrar(ordemId, dados.cliente.id, 'avulsa', texto, 'fallback_link');
    return {
      ...r,
      mensagem:
        'O WhatsApp do sistema está desconectado. Abri o WhatsApp Web com a mensagem pronta e a ' +
        'pasta das mídias desta OS — é só arrastar os arquivos para a conversa.',
    };
  }

  try {
    const destino = await resolverDestino(dados.cliente.telefone);
    await filaDoWhatsApp().enfileirar(() => exigirSocket().sendMessage(destino, { text: texto }));

    const midias = await enviarMidiasMarcadas(dados.ctx, ordemId, destino, caminhos);
    const resumo = resumoDeMidias(midias.fotos, midias.videos);

    registrar(ordemId, dados.cliente.id, 'avulsa', texto, 'enviada', midias.caminhos);
    reposEventos.registrarEvento(dados.ctx, {
      ordemId,
      tipo: 'mensagem',
      descricao: `Enviou ${resumo || 'as mídias'} no WhatsApp`,
    });

    log.info(`[whatsapp] mídias da OS ${dados.ordem.numero} enviadas: ${resumo || 'nenhuma'}`);
    return {
      status: 'enviada',
      mensagem: resumo ? `${resumo} enviados no WhatsApp.` : 'Nenhuma mídia pôde ser enviada.',
    };
  } catch (erro) {
    registrar(ordemId, dados.cliente.id, 'avulsa', texto, 'falhou', [], String(erro));
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
 * Manda as fotos e os vídeos marcados como "enviar ao cliente".
 *
 * Fotos primeiro, vídeos depois: a foto chega rápido e já dá o contexto,
 * enquanto o vídeo ainda está subindo.
 *
 * Cada mídia passa pela fila, respeitando o intervalo mínimo — mandar cinco
 * arquivos em rajada é exatamente o comportamento que faz o WhatsApp derrubar
 * o número. Uma mídia que falha não impede as outras nem desfaz o envio do
 * documento: é melhor o cliente receber o orçamento com três fotos de quatro
 * do que não receber nada.
 *
 * A foto vai solta mesmo já estando dentro do PDF. São usos diferentes: no
 * documento ela é miniatura para imprimir e arquivar; solta, o cliente amplia
 * e enxerga a peça.
 */
async function enviarMidiasMarcadas(
  ctx: ReturnType<typeof contexto>,
  ordemId: number,
  destino: string,
  caminhos: CaminhosApp,
): Promise<{ fotos: number; videos: number; caminhos: string[] }> {
  const enviados: string[] = [];
  let fotos = 0;
  let videos = 0;

  const mandar = async (
    midia: { id: number; arquivoPath: string; legenda: string | null },
    tipo: 'foto' | 'video',
  ): Promise<boolean> => {
    const caminho = join(caminhos.midias, midia.arquivoPath);
    if (!existsSync(caminho)) {
      log.warn(`[whatsapp] ${tipo} marcada não está no disco: ${caminho}`);
      return false;
    }

    try {
      const conteudo = readFileSync(caminho);
      await filaDoWhatsApp().enfileirar(() =>
        exigirSocket().sendMessage(
          destino,
          tipo === 'foto'
            ? { image: conteudo, caption: midia.legenda ?? undefined }
            : { video: conteudo, mimetype: 'video/mp4', caption: midia.legenda ?? undefined },
        ),
      );
      enviados.push(caminho);
      return true;
    } catch (erro) {
      log.error(`[whatsapp] falhou ao enviar ${tipo} ${midia.id}`, erro);
      return false;
    }
  };

  for (const foto of fotosParaOCliente(ctx, ordemId)) {
    if (await mandar(foto, 'foto')) fotos++;
  }
  for (const video of videosParaOCliente(ctx, ordemId)) {
    if (await mandar(video, 'video')) videos++;
  }

  return { fotos, videos, caminhos: enviados };
}

/** "2 fotos e 1 vídeo", "1 foto", ou string vazia quando não foi nada. */
export function resumoDeMidias(fotos: number, videos: number): string {
  const partes: string[] = [];
  if (fotos > 0) partes.push(`${fotos} foto${fotos > 1 ? 's' : ''}`);
  if (videos > 0) partes.push(`${videos} vídeo${videos > 1 ? 's' : ''}`);
  return partes.join(' e ');
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
