/**
 * Teste de fumaça do servidor da rede local: pareamento, PIN, limite de
 * tentativas e upload de mídia — contra um servidor de verdade, no ar.
 *
 * Roda sob o Electron porque o servidor usa o banco e o log do processo main.
 *
 *   npm run verificar:lan
 */
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { app } from 'electron';
import sharp from 'sharp';
import { reposClientes, reposOrdens, reposUsuarios, reposVeiculos, reposConfig } from '@jjs/db';

let falhas = 0;
const conferir = (r: string, real: unknown, esp: unknown) => {
  const ok = JSON.stringify(real) === JSON.stringify(esp);
  if (!ok) falhas++;
  console.log(
    `  ${ok ? 'ok  ' : 'FALHOU'} ${r}${ok ? '' : ` -> ${JSON.stringify(real)} != ${JSON.stringify(esp)}`}`,
  );
};

const base = mkdtempSync(join(tmpdir(), 'jjs-lan-'));
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
for (const p of [caminhos.midias, caminhos.backups, caminhos.logs, caminhos.pdfs])
  mkdirSync(p, { recursive: true });

async function main() {
  // Usa o mesmo caminho do app de verdade: prepara o banco e deixa o módulo
  // banco.ts com a conexão aberta, que é o que o servidor consulta.
  const { iniciarBanco, fecharBanco, obterBanco } =
    await import('../apps/desktop/src/main/banco.js');
  const db = iniciarBanco(caminhos);

  const admin = reposConfig.usuarioPadrao({ db, usuarioId: null })!;
  const ctx = { db, usuarioId: admin.id };
  void obterBanco;

  // Mecânico com PIN, e uma OS para mexer.
  reposUsuarios.atualizarUsuario(ctx, admin.id, { pin: '4321' });
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

  const { iniciarServidorLan, lerEstadoDoServidor, pararServidorLan } =
    await import('../apps/desktop/src/main/lan/servidor.js');
  const { gerarTokenDePareamento } = await import('../apps/desktop/src/main/lan/sessao.js');

  console.log('\n## Servidor');
  await iniciarServidorLan(caminhos);
  const estado = lerEstadoDoServidor();
  console.log('  endereço:', estado.url);
  conferir('subiu', estado.rodando, true);
  const url = `http://127.0.0.1:${estado.porta}`;

  console.log('\n## Sem estar pareado, nada abre');
  const semCookie = await fetch(`${url}/api/quadro`);
  conferir('quadro responde 401', semCookie.status, 401);
  const corpo401 = (await semCookie.json()) as { mensagem: string };
  console.log('  mensagem:', corpo401.mensagem);
  conferir('saúde é pública', (await fetch(`${url}/api/saude`)).status, 200);

  console.log('\n## Pareamento pelo QR');
  const ruim = await fetch(`${url}/parear?token=inventado`, { redirect: 'manual' });
  conferir('token inventado é recusado', ruim.status, 400);

  const { token } = gerarTokenDePareamento();
  const pareou = await fetch(`${url}/parear?token=${token}`, { redirect: 'manual' });
  conferir('token válido redireciona', pareou.status, 302);
  const cookie = (pareou.headers.get('set-cookie') ?? '').split(';')[0];
  conferir('veio o cookie do dispositivo', cookie.startsWith('jjs_dispositivo='), true);

  const reuso = await fetch(`${url}/parear?token=${token}`, { redirect: 'manual' });
  conferir('o mesmo QR não serve duas vezes', reuso.status, 400);

  const com = (extra: RequestInit = {}) => ({
    ...extra,
    headers: { cookie, ...(extra.headers ?? {}) },
  });

  console.log('\n## PIN');
  const antesDoPin = await fetch(`${url}/api/quadro`, com());
  conferir('pareado mas sem PIN dá 403', antesDoPin.status, 403);

  const pinErrado = await fetch(
    `${url}/api/entrar`,
    com({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pin: '0000' }),
    }),
  );
  conferir('PIN errado dá 401', pinErrado.status, 401);

  const pinCerto = await fetch(
    `${url}/api/entrar`,
    com({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pin: '4321' }),
    }),
  );
  conferir('PIN certo entra', pinCerto.status, 200);
  console.log('  entrou como:', JSON.stringify(await pinCerto.json()));

  console.log('\n## Limite de tentativas de PIN');
  let bloqueou = 0;
  for (let i = 0; i < 8; i++) {
    const t = await fetch(
      `${url}/api/entrar`,
      com({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pin: '1111' }),
      }),
    );
    if (t.status === 429) bloqueou++;
  }
  console.log('  respostas 429 em 8 tentativas:', bloqueou);
  conferir('bloqueia força bruta', bloqueou > 0, true);

  console.log('\n## Dados da oficina');
  const quadro = await fetch(`${url}/api/quadro`, com());
  conferir('quadro abre', quadro.status, 200);
  const lista = (await quadro.json()) as unknown[];
  conferir('mostra a OS aberta', lista.length, 1);

  const detalhe = await fetch(`${url}/api/os/${os.id}`, com());
  const dados = (await detalhe.json()) as { ordem: { queixas: string }; midias: unknown[] };
  conferir('abre a OS', dados.ordem.queixas, 'Barulho no freio');

  const item = await fetch(
    `${url}/api/os/${os.id}/itens`,
    com({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tipo: 'peca', descricao: 'Pastilha', valorUnitarioCentavos: 18000 }),
    }),
  );
  conferir('mecânico lança item com preço', item.status, 200);

  console.log('\n## Upload de foto');
  const foto = join(base, 'foto.jpg');
  await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#555' } })
    .jpeg()
    .toFile(foto);

  const form = new FormData();
  form.append('momento', 'diagnostico');
  form.append('legenda', 'Disco empenado');
  form.append(
    'arquivo',
    new Blob([new Uint8Array(readFileSync(foto))], { type: 'image/jpeg' }),
    'foto.jpg',
  );

  const envio = await fetch(`${url}/api/os/${os.id}/midias`, com({ method: 'POST', body: form }));
  conferir('upload aceito', envio.status, 200);
  const midia = (await envio.json()) as { id: number; thumbPath: string | null };
  console.log('  mídia', midia.id, '| thumb:', midia.thumbPath);
  conferir('gerou miniatura', midia.thumbPath !== null, true);

  const galeria = (await (await fetch(`${url}/api/os/${os.id}/midias`, com())).json()) as {
    url: string;
    momento: string;
  }[];
  conferir('aparece na galeria', galeria.length, 1);
  conferir('com o momento certo', galeria[0]!.momento, 'diagnostico');

  const arquivo = await fetch(`${url}${galeria[0]!.url}`, com());
  conferir('a foto é servida', arquivo.status, 200);
  console.log(
    '  tamanho servido:',
    Math.round(Number(arquivo.headers.get('content-length')) / 1024),
    'KB',
  );

  const semCookieFoto = await fetch(`${url}${galeria[0]!.url}`);
  conferir('foto de cliente não abre sem estar pareado', semCookieFoto.status, 401);

  console.log('\n## O app do mecânico é servido?');
  const raiz = await fetch(`${url}/`);
  conferir('a raiz responde', raiz.status, 200);
  const html = await raiz.text();
  conferir(
    'é o app do mecânico',
    html.includes('JJS Mecânica') && html.includes('/src/main.tsx') === false,
    true,
  );
  const temScript = /<script[^>]+src="([^"]+)"/.exec(html);
  console.log('  script da build:', temScript?.[1] ?? 'nenhum');
  conferir('tem o bundle', temScript !== null, true);

  if (temScript) {
    const js = await fetch(`${url}${temScript[1]}`);
    conferir('o bundle baixa', js.status, 200);
    console.log('  tamanho:', Math.round(Number(js.headers.get('content-length')) / 1024), 'KB');
  }

  const manifesto = await fetch(`${url}/manifest.webmanifest`);
  conferir('manifesto para "adicionar à tela inicial"', manifesto.status, 200);

  // Rota inexistente do app volta o index (é HashRouter, mas vale a regra).
  const rotaQualquer = await fetch(`${url}/qualquer-coisa`, com());
  conferir('rota do app volta o index', rotaQualquer.status, 200);
  const apiInexistente = await fetch(`${url}/api/nao-existe`, com());
  conferir('rota de API inexistente dá 404', apiInexistente.status, 404);

  console.log('\n## Revogar um celular corta o acesso na hora');
  const { revogarDispositivo, listarDispositivos } =
    await import('../apps/desktop/src/main/lan/sessao.js');
  const pareados = listarDispositivos();
  conferir('há 1 celular pareado', pareados.length, 1);
  revogarDispositivo(pareados[0]!.id);
  const depoisDeRevogar = await fetch(`${url}/api/quadro`, com());
  conferir('o celular revogado perde o acesso', depoisDeRevogar.status, 401);

  await pararServidorLan();
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
