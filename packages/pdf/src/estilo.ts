/**
 * CSS do orçamento A5.
 *
 * Fica separado do conteúdo porque é aqui que mora a briga com impressora:
 * margens em milímetro, quebra de página e a opção de economizar tinta. O
 * mesmo arquivo serve o PDF do WhatsApp e a impressão em papel — as duas
 * coisas nunca podem divergir.
 */
export function estilo(economizarTinta: boolean, duasViasEmA4: boolean): string {
  const faixa = economizarTinta
    ? `
    .cabecalho { border-top: 3mm solid #F2B705; background: #fff; color: #15171B; }
    .cabecalho .oficina-nome { color: #15171B; }`
    : `
    .cabecalho { background: #15171B; color: #fff; }
    .cabecalho .oficina-nome { color: #F2B705; }
    .cabecalho .contato { color: rgba(255,255,255,.75); }`;

  const pagina = duasViasEmA4
    ? `@page { size: A4 landscape; margin: 6mm; }`
    : `@page { size: A5 portrait; margin: 8mm; }`;

  return `
    ${pagina}

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      font-family: 'Barlow', 'Segoe UI', system-ui, sans-serif;
      font-size: 9pt;
      line-height: 1.35;
      color: #15171B;
      /* Sem isto a impressora ignora fundos e a faixa some. */
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .via { width: 100%; }

    ${
      duasViasEmA4
        ? `
    .folha { display: flex; gap: 6mm; align-items: flex-start; }
    .via { width: 50%; border-right: 1px dashed #bbb; padding-right: 6mm; }
    .via:last-child { border-right: none; padding-right: 0; }
    .corte { position: fixed; top: 0; bottom: 0; left: 50%; border-left: 1px dashed #bbb; }`
        : ''
    }

    h1, h2, h3, .titulo, .placa, .total-valor {
      font-family: 'Barlow Condensed', 'Barlow', 'Segoe UI', sans-serif;
      font-weight: 700;
      margin: 0;
    }

    ${faixa}

    .cabecalho {
      display: flex;
      align-items: center;
      gap: 3mm;
      padding: 2mm 2.5mm;
      margin-bottom: 2mm;
    }
    .cabecalho img { max-height: 14mm; max-width: 28mm; object-fit: contain; }
    .cabecalho .oficina-nome { font-size: 16pt; font-style: italic; line-height: 1; }
    .cabecalho .contato { font-size: 7.5pt; margin-top: 0.5mm; }
    .cabecalho .doc { margin-left: auto; text-align: right; }
    .cabecalho .doc .titulo { font-size: 12pt; }
    .cabecalho .doc .numero { font-size: 15pt; }

    .bloco { border: 0.3mm solid #dedcd6; padding: 1.4mm 2mm; margin-bottom: 1.5mm; }
    .bloco h2 {
      font-size: 9.5pt;
      text-transform: uppercase;
      letter-spacing: .04em;
      margin-bottom: 1mm;
    }

    .identificacao { display: flex; gap: 2.5mm; align-items: center; }
    .placa {
      border: 0.5mm solid #15171B;
      border-top: 1.2mm solid #0c3d91;
      border-radius: 1mm;
      padding: 0.8mm 2mm 0.4mm;
      font-size: 13pt;
      letter-spacing: .06em;
      white-space: nowrap;
    }
    .identificacao dl { flex: 1; display: grid; grid-template-columns: 2.2fr 2.2fr 1fr; gap: 0 2.5mm; margin: 0; }
    .identificacao dt { font-size: 6.5pt; text-transform: uppercase; color: #6b6f76; }
    .identificacao dd { margin: 0; font-size: 9pt; }

    .texto-livre { white-space: pre-wrap; }

    /* Queixa e diagnóstico lado a lado: são textos curtos e, empilhados,
       empurravam o rodapé para uma segunda página quase vazia. */
    .relatos { display: grid; grid-template-columns: 1fr 1fr; gap: 1.8mm; }
    .relatos > .bloco { margin-bottom: 0; }

    /* Condições ocupam a metade livre ao lado dos totais, em vez de um bloco
       próprio embaixo. */
    .fechamento { display: flex; gap: 3mm; align-items: flex-start; }
    .fechamento .condicoes { flex: 1; display: grid; grid-template-columns: 1fr; gap: 1mm; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 0.5mm; }
    thead th {
      font-size: 7pt;
      text-transform: uppercase;
      text-align: left;
      border-bottom: 0.3mm solid #15171B;
      padding: 0.5mm 1mm;
    }
    tbody td { padding: 0.55mm 1mm; border-bottom: 0.2mm solid #eceae4; vertical-align: top; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .obs-item { font-size: 7pt; color: #6b6f76; }
    /* Linha de item não pode ser partida entre páginas. */
    tbody tr { break-inside: avoid; }

    .recusado td { color: #9a9a9a; text-decoration: line-through; }

    .resumo { width: 58%; flex-shrink: 0; }
    .resumo div { display: flex; justify-content: space-between; padding: 0.6mm 0; }
    .resumo .total {
      border-top: 0.6mm solid #15171B;
      margin-top: 1mm;
      padding-top: 1.2mm;
    }
    .resumo .total span { font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 13pt; }

    .condicoes dt { font-size: 6.5pt; text-transform: uppercase; color: #6b6f76; }
    .condicoes dd { margin: 0; }

    .garantia { font-size: 7pt; color: #3b3f45; }
    .garantia h2 { margin-bottom: 0.6mm; }

    .fotos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5mm; }
    .fotos figure { margin: 0; break-inside: avoid; }
    .fotos img { width: 100%; height: 26mm; object-fit: cover; border: 0.2mm solid #dedcd6; }
    .fotos figcaption { font-size: 6.5pt; color: #6b6f76; margin-top: .5mm; }

    .assinatura { margin-top: 2.5mm; display: flex; gap: 6mm; }
    .assinatura div { flex: 1; border-top: 0.3mm solid #15171B; padding-top: 1mm; font-size: 7pt; text-align: center; }

    .rodape {
      margin-top: 2mm;
      padding-top: 1.2mm;
      border-top: 0.3mm solid #dedcd6;
      font-size: 7pt;
      color: #6b6f76;
      display: flex;
      justify-content: space-between;
      gap: 2mm;
    }
  `;
}
