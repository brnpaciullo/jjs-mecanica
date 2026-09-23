/**
 * Fecha o ciclo das mídias: foto salva → marcada para o cliente → aparece
 * dentro do PDF do orçamento. Também confere a caixa "Mídias sem OS".
 *
 *   npm run verificar:midias
 */
import { mkdirSync, mkdtempSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { app } from 'electron';
import sharp from 'sharp';
import { reposClientes, reposConfig, reposItens, reposOrdens, reposVeiculos } from '@jjs/db';

let falhas = 0;
const conferir = (r: string, real: unknown, esp: unknown) => {
  const ok = JSON.stringify(real) === JSON.stringify(esp);
  if (!ok) falhas++;
  console.log(
    `  ${ok ? 'ok  ' : 'FALHOU'} ${r}${ok ? '' : ` -> ${JSON.stringify(real)} != ${JSON.stringify(esp)}`}`,
  );
};

const base = mkdtempSync(join(tmpdir(), 'jjs-midias-'));
const caminhos = {
  userData: base,
  arquivoDb: join(base, 'jjs.db'),
  midias: join(base, 'midias'),
  midiasInbox: join(base, 'midias', '_inbox'),
  whatsappSession: join(base, 'whatsapp-session'),
  backups: join(base, 'backups'),
  pdfs: join(base, 'pdfs'),
  logs: join(base, 'logs'),
  migrations: join(process.cwd(), 'packages/db/src/migrations'),
};
for (const p of [
  caminhos.midias,
  caminhos.midiasInbox,
  caminhos.backups,
  caminhos.logs,
  caminhos.pdfs,
])
  mkdirSync(p, { recursive: true });

async function main() {
  const { iniciarBanco, fecharBanco } = await import('../apps/desktop/src/main/banco.js');
  const db = iniciarBanco(caminhos);
  const admin = reposConfig.usuarioPadrao({ db, usuarioId: null })!;
  const ctx = { db, usuarioId: admin.id };

  const cliente = reposClientes.criarCliente(ctx, { nome: 'Maria Souza', telefone: '99988-7766' });
  const carro = reposVeiculos.criarVeiculo(ctx, {
    clienteId: cliente.id,
    marca: 'VW',
    modelo: 'Gol',
    placa: 'ABC1234',
  });
  const os = reposOrdens.criarOrdem(ctx, {
    clienteId: cliente.id,
    veiculoId: carro.id,
    queixas: 'Barulho no freio',
  });
  // A OS nasce em 'recepcao', onde o documento é o comprovante de entrada, que
  // não leva fotos. O ciclo conferido aqui é o do orçamento.
  reposOrdens.mudarStatus(ctx, os.id, 'orcamento_enviado');
  reposItens.adicionarItem(ctx, os.id, {
    tipo: 'peca',
    descricao: 'Pastilha',
    valorUnitarioCentavos: 18000,
  });

  const { salvarFoto } = await import('../apps/desktop/src/main/midias/processar.js');
  const { definirEnvioAoCliente, listarMidias, listarMidiasSemOs, anexarMidiaAOrdem } =
    await import('../apps/desktop/src/main/midias/consultar.js');

  console.log('\n## Salvar fotos');
  const bytes = await sharp({
    create: { width: 2400, height: 1600, channels: 3, background: '#d94' },
  })
    .jpeg()
    .toBuffer();
  const f1 = await salvarFoto(caminhos, os.id, bytes, {
    momento: 'diagnostico',
    legenda: 'Disco empenado',
  });
  const f2 = await salvarFoto(caminhos, os.id, bytes, {
    momento: 'servico',
    legenda: 'Depois da troca',
  });
  conferir('2 fotos na OS', listarMidias(ctx, os.id).length, 2);

  console.log('\n## Só a marcada entra no orçamento');
  definirEnvioAoCliente(ctx, f1.id, true);
  const marcadas = listarMidias(ctx, os.id).filter((m) => m.incluirParaCliente);
  conferir('1 marcada para o cliente', marcadas.length, 1);
  void f2;

  const { gerarPdf } = await import('../apps/desktop/src/main/pdf.js');
  const comFoto = await gerarPdf(os.id, caminhos);
  const tamanhoComFoto = statSync(comFoto.caminho).size;
  console.log('  PDF com 1 foto:', Math.round(tamanhoComFoto / 1024), 'KB');

  // pdfimages lista as imagens embutidas no PDF
  const imagens = execFileSync('pdfimages', ['-list', comFoto.caminho], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .slice(2)
    .filter(Boolean);
  console.log('  imagens dentro do PDF:', imagens.length);
  conferir('a foto marcada está dentro do PDF', imagens.length >= 1, true);

  definirEnvioAoCliente(ctx, f1.id, false);
  const semFoto = await gerarPdf(os.id, caminhos);
  const tamanhoSemFoto = statSync(semFoto.caminho).size;
  console.log('  PDF sem foto:', Math.round(tamanhoSemFoto / 1024), 'KB');
  conferir('desmarcar tira a foto do PDF', tamanhoSemFoto < tamanhoComFoto, true);

  // Com 4 fotos marcadas, a grade não pode estourar para uma segunda página
  // num orçamento normal.
  const extras = [];
  for (let i = 0; i < 3; i++)
    extras.push(await salvarFoto(caminhos, os.id, bytes, { momento: 'servico' }));
  for (const e of extras) definirEnvioAoCliente(ctx, e.id, true);
  definirEnvioAoCliente(ctx, f1.id, true);

  const comQuatro = await gerarPdf(os.id, caminhos);
  const paginas = execFileSync('pdfinfo', [comQuatro.caminho], { encoding: 'utf8' })
    .split('\n')
    .find((l) => l.startsWith('Pages'))
    ?.split(/\s+/)[1];
  console.log(
    '  PDF com 4 fotos:',
    Math.round(statSync(comQuatro.caminho).size / 1024),
    'KB,',
    paginas,
    'página(s)',
  );
  conferir('4 fotos ainda cabem em 1 página', paginas, '1');
  console.log('  PDF=' + comQuatro.caminho);

  console.log('\n## Caixa "Mídias sem OS"');
  const antes = listarMidias(ctx, os.id).length;
  const solta = await salvarFoto(caminhos, null, bytes, {
    origem: 'whatsapp',
    legenda: 'sem legenda útil',
  });
  conferir('vai para a caixa', listarMidiasSemOs(ctx).length, 1);
  conferir('não aparece na OS', listarMidias(ctx, os.id).length, antes);

  anexarMidiaAOrdem(ctx, solta.id, os.id);
  conferir('a caixa esvazia ao anexar', listarMidiasSemOs(ctx).length, 0);
  conferir('e a mídia entra na OS', listarMidias(ctx, os.id).length, antes + 1);

  console.log('\n## Vínculo pela legenda, contra o banco real');
  const { acharOrdemPelaLegenda } = await import('../apps/desktop/src/main/whatsapp/vincular.js');
  for (const [legenda, esperado] of [
    [`OS ${os.numero}`, os.id],
    [`#${os.numero}`, os.id],
    ['ABC-1234', os.id],
    ['abc1234 pastilha trocada', os.id],
    ['OS 9999', null],
    ['qualquer coisa', null],
  ] as const) {
    const r = acharOrdemPelaLegenda(ctx, legenda);
    conferir(`"${legenda}"`, r?.ordemId ?? null, esperado);
  }

  fecharBanco();
  console.log(falhas === 0 ? '\n>>> TUDO OK\n' : `\n>>> ${falhas} FALHA(S)\n`);
  app.exit(falhas === 0 ? 0 : 1);
}

app.on('window-all-closed', () => {});
void app.whenReady().then(() =>
  main().catch((e) => {
    console.error('\n>>> ERRO:', e);
    app.exit(1);
  }),
);
