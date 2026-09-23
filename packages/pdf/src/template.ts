import {
  ROTULO_TIPO_ITEM,
  calcularTotais,
  formatarData,
  formatarDinheiro,
  formatarDinheiroSemSimbolo,
  formatarNumeroOs,
  formatarPlaca,
  formatarTelefone,
  totalItem,
  type TipoItem,
} from '@jjs/core';
import { estilo } from './estilo.js';
import type { DadosPdf, ItemPdf, OpcoesPdf, ResultadoTemplate, VariacaoPdf } from './tipos.js';

/** Escapa antes de injetar no HTML. Nome de cliente com "&" ou "<" é comum. */
function esc(texto: unknown): string {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Antes da aprovação o documento é um **Orçamento** e mostra tudo, inclusive o
 * que o cliente ainda não aprovou (riscado), para a conversa ser sobre a lista
 * inteira. Depois de aprovado vira **Ordem de Serviço** e só os itens
 * aprovados aparecem — é o que vai ser executado e cobrado.
 */
export function variacaoPara(status: DadosPdf['ordem']['status']): VariacaoPdf {
  const jaAprovado = ['aprovado', 'em_servico', 'pronto', 'entregue'];
  return jaAprovado.includes(status) ? 'ordem_servico' : 'orcamento';
}

function tabelaDeItens(itens: ItemPdf[], tipo: TipoItem): string {
  const doTipo = itens.filter((i) => i.tipo === tipo);
  if (doTipo.length === 0) return '';

  const linhas = doTipo
    .map((item) => {
      const total = totalItem(item);
      const observacao = item.observacao
        ? `<div class="obs-item">${esc(item.observacao)}</div>`
        : '';
      // Quantidade inteira não mostra casa decimal: "2" e não "2,0".
      const qtd = Number.isInteger(item.quantidade)
        ? String(item.quantidade)
        : item.quantidade.toLocaleString('pt-BR');

      return `
        <tr class="${item.aprovado ? '' : 'recusado'}">
          <td>${esc(item.descricao)}${observacao}</td>
          <td class="num">${qtd}</td>
          <td class="num">${formatarDinheiroSemSimbolo(item.valorUnitarioCentavos)}</td>
          <td class="num">${formatarDinheiroSemSimbolo(total)}</td>
        </tr>`;
    })
    .join('');

  return `
    <div class="bloco">
      <h2>${ROTULO_TIPO_ITEM[tipo]}</h2>
      <table>
        <thead>
          <tr>
            <th>Descrição</th>
            <th class="num">Qtd</th>
            <th class="num">Unit. (R$)</th>
            <th class="num">Total (R$)</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>`;
}

function via(dados: DadosPdf, variacao: VariacaoPdf): string {
  const { oficina, ordem, cliente, veiculo } = dados;

  // Na Ordem de Serviço só entra o que foi aprovado.
  const itens = variacao === 'ordem_servico' ? dados.itens.filter((i) => i.aprovado) : dados.itens;

  const totais = calcularTotais(dados.itens, ordem.descontoCentavos);
  const titulo = variacao === 'ordem_servico' ? 'Ordem de Serviço' : 'Orçamento';

  const contato = [oficina.endereco, oficina.telefone, oficina.cnpj ? `CNPJ ${oficina.cnpj}` : null]
    .filter(Boolean)
    .map(esc)
    .join(' · ');

  const logo = oficina.logoDataUri ? `<img src="${oficina.logoDataUri}" alt="" />` : '';

  const fotos =
    dados.fotos.length > 0
      ? `<div class="bloco">
           <h2>Fotos</h2>
           <div class="fotos">
             ${dados.fotos
               .map(
                 (f) => `<figure>
                   <img src="${f.dataUri}" alt="" />
                   ${f.legenda ? `<figcaption>${esc(f.legenda)}</figcaption>` : ''}
                 </figure>`,
               )
               .join('')}
           </div>
         </div>`
      : '';

  const diagnostico = ordem.diagnostico
    ? `<div class="bloco">
         <h2>O que a oficina constatou</h2>
         <div class="texto-livre">${esc(ordem.diagnostico)}</div>
       </div>`
    : '';

  const desconto =
    totais.descontoCentavos > 0
      ? `<div><span>Desconto</span><span>− ${formatarDinheiro(totais.descontoCentavos)}</span></div>`
      : '';

  const garantia = oficina.textoGarantia
    ? `<div class="bloco garantia"><h2>Garantia</h2>${esc(oficina.textoGarantia)}</div>`
    : '';

  return `
  <section class="via">
    <header class="cabecalho">
      ${logo}
      <div>
        <div class="oficina-nome">${esc(oficina.nome)}</div>
        ${contato ? `<div class="contato">${contato}</div>` : ''}
      </div>
      <div class="doc">
        <div class="titulo">${titulo}</div>
        <div class="numero">${formatarNumeroOs(ordem.numero)}</div>
        <div>${formatarData(ordem.criadoEm)}</div>
      </div>
    </header>

    <div class="bloco identificacao">
      <span class="placa">${esc(formatarPlaca(veiculo.placa))}</span>
      <dl>
        <div>
          <dt>Cliente</dt>
          <dd>${esc(cliente.nome)} · ${esc(formatarTelefone(cliente.telefone))}</dd>
        </div>
        <div>
          <dt>Veículo</dt>
          <dd>${esc([`${veiculo.marca} ${veiculo.modelo}`, veiculo.ano, veiculo.cor].filter(Boolean).join(' · '))}</dd>
        </div>
        <div>
          <dt>Km de entrada</dt>
          <dd>${ordem.kmEntrada ? ordem.kmEntrada.toLocaleString('pt-BR') : '—'}</dd>
        </div>
      </dl>
    </div>

    <div class="relatos">
      <div class="bloco">
        <h2>O que o cliente relatou</h2>
        <div class="texto-livre">${esc(ordem.queixas)}</div>
      </div>
      ${diagnostico}
    </div>

    ${tabelaDeItens(itens, 'peca')}
    ${tabelaDeItens(itens, 'mao_de_obra')}

    <div class="bloco fechamento">
      <dl class="condicoes">
        <div><dt>Prazo</dt><dd>${esc(ordem.prazoEstimado ?? 'a combinar')}</dd></div>
        <div><dt>Validade</dt><dd>${ordem.validadeAte ? formatarData(ordem.validadeAte) : '—'}</dd></div>
        <div><dt>Pagamento</dt><dd>${esc(ordem.formaPagamento ?? 'a combinar')}</dd></div>
      </dl>
      <div class="resumo">
        <div><span>Peças</span><span>${formatarDinheiro(totais.subtotalPecasCentavos)}</span></div>
        <div><span>Mão de obra</span><span>${formatarDinheiro(totais.subtotalMaoDeObraCentavos)}</span></div>
        ${desconto}
        <div class="total"><span>TOTAL</span><span class="total-valor">${formatarDinheiro(totais.totalCentavos)}</span></div>
      </div>
    </div>

    ${garantia}
    ${fotos}

    <div class="assinatura">
      <div>Assinatura do cliente</div>
      <div>${esc(oficina.nome)}</div>
    </div>

    <footer class="rodape">
      <span>${esc(oficina.mensagemRodape ?? '')}</span>
      <span>${esc(oficina.telefone ?? '')}</span>
    </footer>
  </section>`;
}

/** Monta o HTML completo, pronto para a janela oculta renderizar. */
export function gerarHtml(dados: DadosPdf, opcoes: OpcoesPdf = {}): ResultadoTemplate {
  const variacao = opcoes.variacao ?? variacaoPara(dados.ordem.status);
  const duasVias = opcoes.duasViasEmA4 === true;
  const titulo = variacao === 'ordem_servico' ? 'Ordem de Serviço' : 'Orçamento';
  const totais = calcularTotais(dados.itens, dados.ordem.descontoCentavos);

  const corpo = duasVias
    ? `<div class="folha">${via(dados, variacao)}${via(dados, variacao)}</div>`
    : via(dados, variacao);

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${esc(titulo)} ${formatarNumeroOs(dados.ordem.numero)}</title>
<style>${estilo(dados.oficina.economizarTinta, duasVias)}</style>
</head>
<body>${corpo}</body>
</html>`;

  const prefixo = variacao === 'ordem_servico' ? 'OS' : 'Orcamento';
  const numero = String(dados.ordem.numero).padStart(4, '0');
  const nomeArquivo = `${prefixo}-OS${numero}-${dados.veiculo.placa}.pdf`;

  return { html, variacao, titulo, totais, nomeArquivo };
}
