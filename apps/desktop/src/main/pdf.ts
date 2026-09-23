import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BrowserWindow } from 'electron';
import { gerarHtml, type DadosPdf, type OpcoesPdf, type ResultadoTemplate } from '@jjs/pdf';
import { reposConfig, reposItens, reposOrdens, reposVeiculos, reposClientes } from '@jjs/db';
import { obterBanco, obterUsuarioPadrao } from './banco.js';
import type { CaminhosApp } from './caminhos.js';
import { logoComoDataUri } from './logo.js';
import { fotosParaOCliente } from './midias/consultar.js';
import { log } from './log.js';

/**
 * As fontes vão embutidas no HTML do orçamento.
 *
 * A janela que renderiza o PDF é isolada e não enxerga as fontes da interface;
 * sem isto o documento sairia em Times New Roman, que é justamente o contrário
 * da identidade da oficina. São 3 arquivos woff2 (~70 KB), lidos uma vez e
 * guardados em memória.
 */
let cssDasFontes: string | null = null;

function fontesEmbutidas(): string {
  if (cssDasFontes !== null) return cssDasFontes;

  // O mesmo caminho relativo serve dev e produção: em dev __dirname é
  // out/main dentro de apps/desktop; empacotado é out/main dentro do asar.
  // Subindo dois níveis, recursos/ está no mesmo lugar nos dois casos.
  const pasta = join(__dirname, '..', '..', 'recursos', 'fontes');

  const carregar = (arquivo: string): string | null => {
    const caminho = join(pasta, arquivo);
    if (!existsSync(caminho)) {
      log.warn(`[pdf] fonte não encontrada: ${caminho}`);
      return null;
    }
    return readFileSync(caminho).toString('base64');
  };

  const regra = (familia: string, peso: number, base64: string | null) =>
    base64
      ? `@font-face{font-family:'${familia}';font-style:normal;font-weight:${peso};src:url(data:font/woff2;base64,${base64}) format('woff2');}`
      : '';

  cssDasFontes = [
    regra('Barlow', 400, carregar('barlow-latin-400-normal.woff2')),
    regra('Barlow', 700, carregar('barlow-latin-700-normal.woff2')),
    regra('Barlow Condensed', 700, carregar('barlow-condensed-latin-700-normal.woff2')),
  ].join('');

  return cssDasFontes;
}

/** Junta tudo que o template precisa, a partir do banco. */
export function montarDadosPdf(ordemId: number, caminhos: CaminhosApp): DadosPdf {
  const ctx = { db: obterBanco(), usuarioId: obterUsuarioPadrao() };

  const ordem = reposOrdens.buscarOrdem(ctx, ordemId);
  if (!ordem) throw new Error('Essa OS não foi encontrada.');

  const cliente = reposClientes.buscarCliente(ctx, ordem.clienteId);
  const veiculo = reposVeiculos.buscarVeiculo(ctx, ordem.veiculoId);
  if (!cliente || !veiculo) throw new Error('O cliente ou o carro dessa OS não foi encontrado.');

  const config = reposConfig.lerConfig(ctx);
  const itens = reposItens.listarItens(ctx, ordemId);

  return {
    oficina: {
      nome: config.nome,
      cnpj: config.cnpj,
      endereco: config.endereco,
      telefone: config.telefone,
      logoDataUri: logoComoDataUri(config.logoPath),
      textoGarantia: config.textoGarantia,
      mensagemRodape: config.mensagemRodapePdf,
      economizarTinta: config.economizarTinta,
    },
    ordem: {
      numero: ordem.numero,
      status: ordem.status,
      criadoEm: ordem.criadoEm,
      queixas: ordem.queixas,
      diagnostico: ordem.diagnostico,
      prazoEstimado: ordem.prazoEstimado,
      validadeAte: ordem.validadeAte,
      formaPagamento: ordem.formaPagamento,
      kmEntrada: ordem.kmEntrada,
      combustivel: ordem.combustivel,
      checklistEntrada: ordem.checklistEntrada,
      descontoCentavos: ordem.descontoCentavos,
    },
    cliente: { nome: cliente.nome, telefone: cliente.telefone },
    veiculo: {
      marca: veiculo.marca,
      modelo: veiculo.modelo,
      placa: veiculo.placa,
      ano: veiculo.ano,
      cor: veiculo.cor,
    },
    itens: itens.map((i) => ({
      tipo: i.tipo,
      descricao: i.descricao,
      quantidade: i.quantidade,
      valorUnitarioCentavos: i.valorUnitarioCentavos,
      observacao: i.observacao,
      aprovado: i.aprovado,
    })),
    fotos: fotosDoOrcamento(ctx, ordemId, caminhos.midias),
  };
}

/**
 * Fotos marcadas para o cliente, embutidas no PDF.
 *
 * Vão as **miniaturas**, não as fotos inteiras: são 6 por linha num papel A5,
 * onde nada passa de 3cm. Usar a imagem de 1920px multiplicaria o tamanho do
 * PDF por dez e faria o WhatsApp recusar o envio, sem nenhum ganho visível.
 */
function fotosDoOrcamento(
  ctx: { db: ReturnType<typeof obterBanco>; usuarioId: number | null },
  ordemId: number,
  pasta: string,
) {
  return fotosParaOCliente(ctx, ordemId)
    .map((foto) => {
      const relativo = foto.thumbPath ?? foto.arquivoPath;
      const caminho = join(pasta, relativo);
      if (!existsSync(caminho)) {
        log.warn(`[pdf] foto não encontrada no disco: ${caminho}`);
        return null;
      }
      return {
        dataUri: `data:image/jpeg;base64,${readFileSync(caminho).toString('base64')}`,
        legenda: foto.legenda,
      };
    })
    .filter((f): f is { dataUri: string; legenda: string | null } => f !== null);
}

function comFontes(resultado: ResultadoTemplate): string {
  return resultado.html.replace('<style>', `<style>${fontesEmbutidas()}`);
}

/**
 * Renderiza o HTML numa janela oculta e devolve o `webContents` pronto.
 * Quem chama decide se vira PDF ou vai para a impressora — as duas saídas usam
 * exatamente o mesmo documento, que é o ponto do template único.
 */
async function renderizar<T>(
  html: string,
  caminhos: CaminhosApp,
  usar: (janela: BrowserWindow) => Promise<T>,
): Promise<T> {
  const temporario = join(caminhos.pdfs, `.render-${Date.now()}.html`);
  mkdirSync(caminhos.pdfs, { recursive: true });
  writeFileSync(temporario, html, 'utf8');

  const janela = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true, javascript: false, sandbox: true },
  });

  try {
    await janela.loadFile(temporario);
    // Dá um tique para as fontes embutidas serem aplicadas antes de imprimir.
    await janela.webContents.executeJavaScript('void 0').catch(() => undefined);
    return await usar(janela);
  } finally {
    if (!janela.isDestroyed()) janela.destroy();
    rmSync(temporario, { force: true });
  }
}

export interface ResultadoPdf {
  caminho: string;
  nomeArquivo: string;
  titulo: string;
}

/** Gera o PDF e devolve onde ele foi salvo. */
export async function gerarPdf(
  ordemId: number,
  caminhos: CaminhosApp,
  opcoes: OpcoesPdf = {},
): Promise<ResultadoPdf> {
  const dados = montarDadosPdf(ordemId, caminhos);
  const resultado = gerarHtml(dados, opcoes);

  const bytes = await renderizar(comFontes(resultado), caminhos, (janela) =>
    janela.webContents.printToPDF({
      pageSize: opcoes.duasViasEmA4 ? 'A4' : 'A5',
      landscape: opcoes.duasViasEmA4 === true,
      printBackground: true,
      // Zero aqui porque a margem de verdade (8mm) vem do @page do CSS.
      // Sem isto o Electron soma 1cm por fora e o conteúdo encolhe.
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    }),
  );

  const caminho = join(caminhos.pdfs, resultado.nomeArquivo);
  writeFileSync(caminho, bytes);
  log.info(`[pdf] gerado: ${caminho} (${Math.round(bytes.byteLength / 1024)} KB)`);

  return { caminho, nomeArquivo: resultado.nomeArquivo, titulo: resultado.titulo };
}

/**
 * Manda para a impressora.
 *
 * `silent: false` de propósito: a caixa do Windows aparece para conferir a
 * impressora e o tamanho do papel. Se o driver não aceitar A5, a tela oferece
 * "Imprimir em A4 com 2 vias", que é o mesmo documento duplicado numa folha
 * deitada para cortar ao meio.
 */
export async function imprimir(
  ordemId: number,
  caminhos: CaminhosApp,
  opcoes: OpcoesPdf = {},
): Promise<{ impresso: boolean; motivo?: string }> {
  const ctx = { db: obterBanco(), usuarioId: obterUsuarioPadrao() };
  const config = reposConfig.lerConfig(ctx);

  const dados = montarDadosPdf(ordemId, caminhos);
  const resultado = gerarHtml(dados, opcoes);

  return renderizar(
    comFontes(resultado),
    caminhos,
    (janela) =>
      new Promise((resolver) => {
        janela.webContents.print(
          {
            silent: false,
            printBackground: true,
            pageSize: opcoes.duasViasEmA4 ? 'A4' : 'A5',
            landscape: opcoes.duasViasEmA4 === true,
            ...(config.impressoraPadrao ? { deviceName: config.impressoraPadrao } : {}),
          },
          (impresso, motivo) => {
            if (!impresso) log.warn(`[pdf] impressão não concluída: ${motivo}`);
            resolver({ impresso, motivo });
          },
        );
      }),
  );
}

export interface ImpressoraNaTela {
  /** Nome que o sistema entende — é o que vai em `deviceName`. */
  nome: string;
  /** Nome que a pessoa reconhece na caixa de impressão. */
  rotulo: string;
  padraoDoSistema: boolean;
}

/**
 * Impressoras vistas pelo sistema, para a tela de Configurações.
 * O `PrinterInfo` do Electron 44 não expõe mais `isDefault`; o que sobra é a
 * opção específica de plataforma, por isso a leitura defensiva.
 */
export async function listarImpressoras(): Promise<ImpressoraNaTela[]> {
  const janela = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  try {
    const lista = await janela.webContents.getPrintersAsync();
    return lista.map((impressora) => {
      const opcoes = impressora.options as Record<string, unknown> | undefined;
      const padrao = opcoes?.['printer-is-default'] ?? opcoes?.['is-default'];
      return {
        nome: impressora.name,
        rotulo: impressora.displayName || impressora.name,
        padraoDoSistema: padrao === true || padrao === 'true',
      };
    });
  } finally {
    janela.destroy();
  }
}
