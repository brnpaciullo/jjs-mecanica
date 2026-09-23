import { describe, expect, it } from 'vitest';
import { gerarHtml, variacaoPara } from '../src/template.js';
import type { DadosPdf, ItemPdf } from '../src/tipos.js';

const item = (p: Partial<ItemPdf> = {}): ItemPdf => ({
  tipo: 'peca',
  descricao: 'Pastilha de freio',
  quantidade: 1,
  valorUnitarioCentavos: 18000,
  observacao: null,
  aprovado: true,
  ...p,
});

const dados = (p: Partial<DadosPdf> = {}): DadosPdf => ({
  oficina: {
    nome: 'JJS Oficina Mecânica',
    cnpj: '12.345.678/0001-90',
    endereco: 'Rua das Oficinas, 100 — Curitiba/PR',
    telefone: '(41) 3333-4444',
    logoDataUri: null,
    textoGarantia: 'Garantia de 90 dias para a mão de obra.',
    mensagemRodape: 'Obrigado pela preferência!',
    economizarTinta: true,
  },
  ordem: {
    numero: 42,
    status: 'orcamento_enviado',
    criadoEm: new Date(2026, 8, 22, 10, 0).toISOString(),
    queixas: 'Barulho na frente quando freia.',
    diagnostico: 'Pastilhas no fim e disco empenado.',
    prazoEstimado: '2 dias úteis',
    validadeAte: new Date(2026, 8, 29, 10, 0).toISOString(),
    formaPagamento: null,
    kmEntrada: 87000,
    descontoCentavos: 0,
  },
  cliente: { nome: 'Maria Souza', telefone: '5541999887766' },
  veiculo: { marca: 'Volkswagen', modelo: 'Gol 1.0', placa: 'ABC1234', ano: 2018, cor: 'Prata' },
  itens: [
    item(),
    item({ tipo: 'mao_de_obra', descricao: 'Troca de pastilhas', valorUnitarioCentavos: 12000 }),
  ],
  fotos: [],
  ...p,
});

describe('variacaoPara', () => {
  it('antes da aprovação é Orçamento', () => {
    expect(variacaoPara('recepcao')).toBe('orcamento');
    expect(variacaoPara('diagnostico')).toBe('orcamento');
    expect(variacaoPara('orcamento_enviado')).toBe('orcamento');
    expect(variacaoPara('recusado')).toBe('orcamento');
  });

  it('depois da aprovação é Ordem de Serviço', () => {
    expect(variacaoPara('aprovado')).toBe('ordem_servico');
    expect(variacaoPara('em_servico')).toBe('ordem_servico');
    expect(variacaoPara('pronto')).toBe('ordem_servico');
    expect(variacaoPara('entregue')).toBe('ordem_servico');
  });
});

describe('as duas variações', () => {
  it('o Orçamento mostra até o item não aprovado, riscado', () => {
    const r = gerarHtml(
      dados({ itens: [item(), item({ descricao: 'Disco de freio', aprovado: false })] }),
    );
    expect(r.variacao).toBe('orcamento');
    expect(r.titulo).toBe('Orçamento');
    expect(r.html).toContain('Disco de freio');
    expect(r.html).toContain('class="recusado"');
  });

  it('a Ordem de Serviço esconde o que não foi aprovado', () => {
    const r = gerarHtml(
      dados({
        ordem: { ...dados().ordem, status: 'aprovado' },
        itens: [item(), item({ descricao: 'Disco de freio', aprovado: false })],
      }),
    );
    expect(r.variacao).toBe('ordem_servico');
    expect(r.titulo).toBe('Ordem de Serviço');
    expect(r.html).not.toContain('Disco de freio');
  });

  it('o total ignora o item recusado nas duas variações', () => {
    const itens = [
      item({ valorUnitarioCentavos: 10000 }),
      item({ valorUnitarioCentavos: 90000, aprovado: false }),
    ];
    const orcamento = gerarHtml(dados({ itens }));
    const os = gerarHtml(dados({ ordem: { ...dados().ordem, status: 'aprovado' }, itens }));

    expect(orcamento.totais.totalCentavos).toBe(10000);
    expect(os.totais.totalCentavos).toBe(10000);
  });
});

describe('conteúdo do documento', () => {
  it('traz o que a oficina precisa mostrar', () => {
    const r = gerarHtml(dados());
    expect(r.html).toContain('JJS Oficina Mecânica');
    expect(r.html).toContain('OS 0042');
    expect(r.html).toContain('ABC-1234');
    expect(r.html).toContain('Maria Souza');
    expect(r.html).toContain('(41) 99988-7766');
    expect(r.html).toContain('Volkswagen Gol 1.0');
    expect(r.html).toContain('87.000');
    expect(r.html).toContain('Barulho na frente quando freia.');
    expect(r.html).toContain('Pastilhas no fim e disco empenado.');
    expect(r.html).toContain('Garantia de 90 dias');
    expect(r.html).toContain('22/09/2026');
    expect(r.html).toContain('29/09/2026');
  });

  it('mostra o total em reais', () => {
    const r = gerarHtml(dados());
    expect(r.totais.totalCentavos).toBe(30000);
    expect(r.html).toMatch(/R\$\s*300,00/);
  });

  it('mostra o desconto só quando existe', () => {
    expect(gerarHtml(dados()).html).not.toContain('Desconto');
    const comDesconto = gerarHtml(dados({ ordem: { ...dados().ordem, descontoCentavos: 5000 } }));
    expect(comDesconto.html).toContain('Desconto');
    expect(comDesconto.totais.totalCentavos).toBe(25000);
  });

  it('a observação do item aparece embaixo, em letra menor', () => {
    const r = gerarHtml(dados({ itens: [item({ observacao: 'Peça original' })] }));
    expect(r.html).toContain('obs-item');
    expect(r.html).toContain('Peça original');
  });

  it('quantidade inteira não ganha casa decimal', () => {
    const r = gerarHtml(dados({ itens: [item({ quantidade: 2 })] }));
    expect(r.html).toContain('<td class="num">2</td>');
  });

  it('embute o logo quando existe', () => {
    const semLogo = gerarHtml(dados());
    expect(semLogo.html).not.toContain('<img src="data:image');

    const comLogo = gerarHtml(
      dados({ oficina: { ...dados().oficina, logoDataUri: 'data:image/png;base64,AAAA' } }),
    );
    expect(comLogo.html).toContain('data:image/png;base64,AAAA');
  });

  it('embute as fotos marcadas', () => {
    const r = gerarHtml(
      dados({ fotos: [{ dataUri: 'data:image/jpeg;base64,BBBB', legenda: 'Disco empenado' }] }),
    );
    expect(r.html).toContain('data:image/jpeg;base64,BBBB');
    expect(r.html).toContain('Disco empenado');
  });
});

describe('impressão', () => {
  it('A5 retrato por padrão, com margem de 8mm', () => {
    const r = gerarHtml(dados());
    expect(r.html).toContain('size: A5 portrait');
    expect(r.html).toContain('margin: 8mm');
  });

  it('duas vias vira A4 deitado com duas cópias', () => {
    const r = gerarHtml(dados(), { duasViasEmA4: true });
    expect(r.html).toContain('size: A4 landscape');
    expect(r.html.match(/class="via"/g)?.length).toBe(2);
  });

  it('economizar tinta troca o bloco preto pela faixa amarela', () => {
    const economico = gerarHtml(dados());
    expect(economico.html).toContain('border-top: 3mm solid #F2B705');

    const comFundo = gerarHtml(dados({ oficina: { ...dados().oficina, economizarTinta: false } }));
    expect(comFundo.html).toContain('background: #15171B');
  });
});

describe('nome do arquivo', () => {
  it('identifica OS e placa, como pedido no WhatsApp', () => {
    expect(gerarHtml(dados()).nomeArquivo).toBe('Orcamento-OS0042-ABC1234.pdf');
    expect(gerarHtml(dados({ ordem: { ...dados().ordem, status: 'aprovado' } })).nomeArquivo).toBe(
      'OS-OS0042-ABC1234.pdf',
    );
  });
});

describe('segurança do HTML', () => {
  it('escapa o que vem do cadastro — nome com < e & não quebra o documento', () => {
    const r = gerarHtml(
      dados({ cliente: { nome: 'Sousa & Filhos <oficina>', telefone: '5541999887766' } }),
    );
    expect(r.html).toContain('Sousa &amp; Filhos &lt;oficina&gt;');
    expect(r.html).not.toContain('<oficina>');
  });
});
