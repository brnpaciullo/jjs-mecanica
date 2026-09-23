/**
 * Teste de fumaça do fluxo do balcão, ponta a ponta, contra um banco de
 * verdade num diretório temporário.
 *
 * Roda sob o runtime do Electron (ELECTRON_RUN_AS_NODE) porque o
 * better-sqlite3 é compilado para o ABI do Electron — o Node puro do vitest
 * não consegue carregá-lo. Por isso este teste mora aqui, e não junto
 * dos testes unitários dos pacotes.
 *
 *   npm run verificar:fluxo
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  prepararBanco,
  reposBusca,
  reposCatalogo,
  reposClientes,
  reposConfig,
  reposEventos,
  reposItens,
  reposOrdens,
  reposVeiculos,
  type Contexto,
} from '@jjs/db';
import { formatarDinheiro, formatarNumeroOs, formatarPlaca, formatarTelefone } from '@jjs/core';

const base = mkdtempSync(join(tmpdir(), 'jjs-fluxo-'));
const r = prepararBanco({
  arquivoDb: join(base, 'jjs.db'),
  pastaBackups: join(base, 'backups'),
  pastaMigrations: join(process.cwd(), 'packages/db/src/migrations'),
});

const admin = reposConfig.usuarioPadrao({ db: r.db, usuarioId: null });
const ctx: Contexto = { db: r.db, usuarioId: admin!.id };

let falhas = 0;
function conferir(rotulo: string, real: unknown, esperado: unknown) {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(
    `${ok ? '  ok  ' : '  FALHOU '} ${rotulo}${ok ? '' : ` -> ${JSON.stringify(real)} != ${JSON.stringify(esperado)}`}`,
  );
}
function recusa(rotulo: string, fn: () => unknown) {
  try {
    fn();
    falhas++;
    console.log(`  FALHOU  ${rotulo} (devia ter recusado)`);
  } catch (e) {
    console.log(`  ok   ${rotulo} -> "${(e as Error).message}"`);
  }
}

console.log('\n## Catálogo semeado');
const cat = reposCatalogo.listarCatalogo(ctx);
console.log(`  ${cat.length} itens`);
const categorias = [...new Set(cat.map((c) => c.categoria))];
conferir('7 categorias', categorias.length, 7);
console.log(`  câmbio: ${cat.filter((c) => c.categoria === 'Câmbio').length} itens`);

console.log('\n## Cadastro de cliente e carro');
const cliente = reposClientes.criarCliente(ctx, { nome: 'Maria Souza', telefone: '99988-7766' });
conferir('telefone normalizado com DDD 41', cliente.telefone, '5541999887766');
console.log(`  exibido como ${formatarTelefone(cliente.telefone)}`);

recusa('telefone repetido', () =>
  reposClientes.criarCliente(ctx, { nome: 'Outro', telefone: '(41) 99988-7766' }),
);

const carro = reposVeiculos.criarVeiculo(ctx, {
  clienteId: cliente.id,
  marca: 'Volkswagen',
  modelo: 'Gol 1.0',
  placa: 'abc-1234',
  ano: 2018,
  cor: 'Prata',
});
conferir('placa normalizada', carro.placa, 'ABC1234');
console.log(`  exibida como ${formatarPlaca(carro.placa)}`);

recusa('placa repetida', () =>
  reposVeiculos.criarVeiculo(ctx, {
    clienteId: cliente.id,
    marca: 'X',
    modelo: 'Y',
    placa: 'ABC1234',
  }),
);
recusa('placa inválida', () =>
  reposVeiculos.criarVeiculo(ctx, {
    clienteId: cliente.id,
    marca: 'X',
    modelo: 'Y',
    placa: 'AB-123',
  }),
);
try {
  reposVeiculos.criarVeiculo(ctx, {
    clienteId: cliente.id,
    marca: 'X',
    modelo: 'Y',
    placa: 'AB-123',
  });
} catch (e) {
  const msg = (e as Error).message;
  conferir(
    'erro de validação chega em português, sem JSON',
    !msg.includes('{') && !msg.includes('['),
    true,
  );
}

console.log('\n## Abrir atendimento');
const os = reposOrdens.criarOrdem(ctx, {
  clienteId: cliente.id,
  veiculoId: carro.id,
  queixas: 'Barulho na frente quando freia e câmbio demora para engatar.',
  kmEntrada: 87000,
  combustivel: '1/2',
});
conferir('número começa em 1', os.numero, 1);
conferir('nasce em recepção', os.status, 'recepcao');
console.log(`  ${formatarNumeroOs(os.numero)} aberta`);
conferir(
  'km foi para o cadastro do carro',
  reposVeiculos.buscarVeiculo(ctx, carro.id)!.kmAtual,
  87000,
);

recusa('OS sem queixas', () =>
  reposOrdens.criarOrdem(ctx, { clienteId: cliente.id, veiculoId: carro.id, queixas: '   ' }),
);

const os2 = reposOrdens.criarOrdem(ctx, {
  clienteId: cliente.id,
  veiculoId: carro.id,
  queixas: 'Revisão',
});
conferir('número é sequencial', os2.numero, 2);

console.log('\n## Itens e totais (aprovação parcial)');
const sugestoes = reposCatalogo.sugerirCatalogo(ctx, 'pastilha');
for (const s of sugestoes) {
  console.log(
    `  "pastilha" -> ${s.descricao} [${s.tipo}] ${s.valorPadraoCentavos === null ? 'a combinar' : formatarDinheiro(s.valorPadraoCentavos)}`,
  );
}
const servico = sugestoes.find((s) => s.tipo === 'mao_de_obra')!;
// Mesma regra da tela: peça sem preço entra zerada, para o balcão digitar.
reposItens.adicionarItem(ctx, os.id, {
  tipo: 'mao_de_obra',
  descricao: servico.descricao,
  quantidade: 1,
  valorUnitarioCentavos: servico.valorPadraoCentavos ?? 0,
});
reposItens.adicionarItem(ctx, os.id, {
  tipo: 'peca',
  descricao: 'Pastilha de freio (jogo)',
  quantidade: 1,
  valorUnitarioCentavos: 18000,
});
const disco = reposItens.adicionarItem(ctx, os.id, {
  tipo: 'peca',
  descricao: 'Disco de freio (par)',
  quantidade: 1,
  valorUnitarioCentavos: 45000,
});

let t = reposItens.totaisDaOrdem(ctx, os.id);
conferir('subtotal peças', t.subtotalPecasCentavos, 63000);
conferir('subtotal mão de obra', t.subtotalMaoDeObraCentavos, 12000);
conferir('total', t.totalCentavos, 75000);
console.log(`  total com tudo: ${formatarDinheiro(t.totalCentavos)}`);

// Cliente recusa o disco
reposItens.atualizarItem(ctx, disco.id, { aprovado: false });
t = reposItens.totaisDaOrdem(ctx, os.id);
conferir('disco recusado sai da conta', t.totalCentavos, 30000);
conferir('conta o item não aprovado', t.itensNaoAprovados, 1);
console.log(`  total sem o disco: ${formatarDinheiro(t.totalCentavos)}`);

reposOrdens.atualizarOrdem(ctx, os.id, { descontoCentavos: 3000 });
t = reposItens.totaisDaOrdem(ctx, os.id);
conferir('desconto aplicado', t.totalCentavos, 27000);

reposOrdens.atualizarOrdem(ctx, os.id, { descontoCentavos: 999999 });
t = reposItens.totaisDaOrdem(ctx, os.id);
conferir('desconto maior que a conta zera, não fica negativo', t.totalCentavos, 0);
reposOrdens.atualizarOrdem(ctx, os.id, { descontoCentavos: 3000 });

console.log('\n## Fluxo de status');
reposOrdens.mudarStatus(ctx, os.id, 'diagnostico');
const enviado = reposOrdens.mudarStatus(ctx, os.id, 'orcamento_enviado');
conferir('validade foi calculada ao enviar', enviado.validadeAte !== null, true);
reposOrdens.mudarStatus(ctx, os.id, 'aprovado');
reposOrdens.mudarStatus(ctx, os.id, 'em_servico');
reposOrdens.mudarStatus(ctx, os.id, 'pronto');
const entregue = reposOrdens.mudarStatus(ctx, os.id, 'entregue', {
  kmSaida: 87050,
  formaPagamento: 'Pix',
});
conferir('forma de pagamento gravada', entregue.formaPagamento, 'Pix');
conferir(
  'km de saída foi para o carro',
  reposVeiculos.buscarVeiculo(ctx, carro.id)!.kmAtual,
  87050,
);
conferir(
  'carimbo de cada etapa',
  [entregue.recepcaoEm, entregue.aprovadoEm, entregue.entregueEm].every(Boolean),
  true,
);

// voltar atrás
const voltou = reposOrdens.mudarStatus(ctx, os.id, 'em_servico');
conferir('voltar é permitido', voltou.status, 'em_servico');
conferir('carimbo original de entregue foi mantido', voltou.entregueEm, entregue.entregueEm);

console.log('\n## Quadro e linha do tempo');
const quadro = reposOrdens.listarQuadro(ctx);
conferir('quadro mostra as 2 OS abertas', quadro.length, 2);
reposOrdens.mudarStatus(ctx, os2.id, 'recusado');
conferir('OS recusada sai do quadro', reposOrdens.listarQuadro(ctx).length, 1);

const eventos = reposEventos.listarEventos(ctx, os.id);
console.log(`  ${eventos.length} eventos na linha do tempo:`);
for (const e of eventos.slice(0, 4)) console.log(`    - ${e.descricao} (${e.usuarioNome})`);
console.log(`    ... e mais ${eventos.length - 4}`);
conferir(
  'a volta ficou registrada',
  eventos.some((e) => e.descricao.startsWith('Voltou de')),
  true,
);

console.log('\n## Busca global');
for (const termo of ['ABC-1234', 'Maria', '99988', 'OS 1']) {
  const achados = reposBusca.buscaGlobal(ctx, termo);
  console.log(
    `  "${termo}" -> ${achados.length} resultado(s): ${achados.map((a) => `${a.tipo}:${a.titulo}`).join(', ')}`,
  );
  conferir(`busca "${termo}" acha algo`, achados.length > 0, true);
}

console.log('\n## Histórico do carro');
const doCarro = reposOrdens.ordensDoVeiculo(ctx, carro.id);
conferir('as 2 OS do carro aparecem', doCarro.length, 2);

r.fechar();
console.log(falhas === 0 ? '\n>>> TUDO OK\n' : `\n>>> ${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
