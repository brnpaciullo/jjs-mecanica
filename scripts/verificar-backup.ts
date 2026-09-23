/**
 * Teste de fumaça do backup, contra banco e mídias de verdade.
 *
 * Roda sob o runtime do Electron porque o better-sqlite3 é compilado para o
 * ABI do Electron. Ver scripts/verificar-fluxo.ts.
 *
 *   npm run verificar:backup
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import Database from 'better-sqlite3';
import { app } from 'electron';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepararBanco, reposClientes, reposConfig, schema } from '@jjs/db';
import { fazerBackup, listarBackups } from '../apps/desktop/src/main/backup/fazer.js';
import { inspecionarBackup, restaurarBackup } from '../apps/desktop/src/main/backup/restaurar.js';
import { lerIndice, precisaDeBackup } from '../apps/desktop/src/main/backup/indice.js';

const base = mkdtempSync(join(tmpdir(), 'jjs-bkp-'));
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

let falhas = 0;
const conferir = (r: string, real: unknown, esp: unknown) => {
  const ok = JSON.stringify(real) === JSON.stringify(esp);
  if (!ok) falhas++;
  console.log(
    `  ${ok ? 'ok  ' : 'FALHOU'} ${r}${ok ? '' : ` -> ${JSON.stringify(real)} != ${JSON.stringify(esp)}`}`,
  );
};

const conteudo = (zip: string) =>
  execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);

async function main() {
  console.log('\n## Banco com dados reais');
  const r = prepararBanco({
    arquivoDb: caminhos.arquivoDb,
    pastaBackups: caminhos.backups,
    pastaMigrations: caminhos.migrations,
  });
  const admin = reposConfig.usuarioPadrao({ db: r.db, usuarioId: null })!;
  const ctx = { db: r.db, usuarioId: admin.id };
  reposClientes.criarCliente(ctx, { nome: 'Maria Souza', telefone: '99988-7766' });
  console.log('  1 cliente criado');

  console.log('\n## Mídias de mentira');
  mkdirSync(join(caminhos.midias, '1'), { recursive: true });
  writeFileSync(join(caminhos.midias, '1', 'foto1.jpg'), randomBytes(300_000));
  writeFileSync(join(caminhos.midias, '1', 'foto2.jpg'), randomBytes(300_000));
  console.log('  2 fotos de ~300 KB (bytes aleatorios, como um JPEG)');

  console.log('\n## 1º backup (leva tudo)');
  const b1 = await fazerBackup(caminhos);
  const c1 = conteudo(b1.arquivo);
  console.log('  conteúdo:', c1.join(', '));
  conferir('o banco foi junto', c1.includes('jjs.db'), true);
  conferir('as 2 fotos foram', c1.filter((n) => n.startsWith('midias/')).length, 2);
  conferir('contou 2 mídias novas', b1.midiasNovas, 2);

  console.log('\n## 2º backup sem nada novo (só o banco)');
  const b2 = await fazerBackup(caminhos);
  const c2 = conteudo(b2.arquivo);
  conferir('nenhuma mídia recopiada', b2.midiasNovas, 0);
  conferir('mas o banco vai sempre', c2.includes('jjs.db'), true);
  console.log(
    '  tamanho 1º:',
    Math.round(b1.tamanhoBytes / 1024),
    'KB | 2º:',
    Math.round(b2.tamanhoBytes / 1024),
    'KB',
  );
  conferir('o 2º é bem menor', b2.tamanhoBytes < b1.tamanhoBytes / 2, true);

  console.log('\n## 3º backup com uma foto nova');
  writeFileSync(join(caminhos.midias, '1', 'foto3.jpg'), randomBytes(300_000));
  const b3 = await fazerBackup(caminhos);
  conferir('levou só a nova', b3.midiasNovas, 1);
  conferir(
    'e só ela está no zip',
    conteudo(b3.arquivo).filter((n) => n.startsWith('midias/')),
    ['midias/1/foto3.jpg'],
  );

  console.log('\n## O banco dentro do zip abre e tem os dados?');
  const extraido = join(base, 'extraido');
  mkdirSync(extraido, { recursive: true });
  execFileSync('unzip', ['-o', '-q', b3.arquivo, 'jjs.db', '-d', extraido]);
  const copia = new Database(join(extraido, 'jjs.db'), { readonly: true });
  conferir('integridade', copia.pragma('integrity_check', { simple: true }), 'ok');
  const cliente = copia.prepare('select nome, telefone from clientes').get() as {
    nome: string;
    telefone: string;
  };
  console.log('  cliente no backup:', JSON.stringify(cliente));
  conferir('o cliente está lá', cliente.nome, 'Maria Souza');
  copia.close();

  console.log('\n## Agendamento');
  const indice = lerIndice(caminhos.backups);
  conferir('logo após um backup, não precisa de outro', precisaDeBackup(indice), false);
  conferir(
    'depois de 25h, precisa',
    precisaDeBackup(indice, new Date(Date.now() + 25 * 3600_000)),
    true,
  );
  conferir(
    'sem backup nenhum, precisa',
    precisaDeBackup({ midias: {}, ultimoBackupEm: null }),
    true,
  );

  console.log('\n## Listagem');
  const lista = listarBackups(caminhos);
  conferir('3 backups guardados', lista.length, 3);
  conferir('mais novo primeiro', lista[0]!.quandoEm >= lista[1]!.quandoEm, true);

  console.log('\n## conteudo.json explica o incremental?');
  execFileSync('unzip', ['-o', '-q', b3.arquivo, 'conteudo.json', '-d', extraido]);
  const meta = JSON.parse(readFileSync(join(extraido, 'conteudo.json'), 'utf8'));
  console.log('  ', JSON.stringify(meta).slice(0, 150) + '...');
  conferir('diz quantas mídias no total', meta.midiasNoTotal, 3);

  // ---------------- restauração ----------------
  console.log('\n## Restauração');

  // Estraga os dados de propósito, como se alguém tivesse apagado tudo.
  reposClientes.criarCliente(ctx, { nome: 'Cliente Errado', telefone: '98888-1111' });
  const antes = r.db.select().from(schema.clientes).all().length;
  console.log('  clientes antes de restaurar:', antes);
  conferir('temos 2 clientes agora', antes, 2);

  const dentro = await inspecionarBackup(b1.arquivo);
  console.log('  conteúdo do 1º backup:', JSON.stringify(dentro));
  conferir('a inspeção vê o banco', dentro.temBanco, true);
  conferir('a inspeção conta as 2 fotos', dentro.midias, 2);

  // Apaga uma foto para conferir que a restauração traz de volta.
  rmSync(join(caminhos.midias, '1', 'foto1.jpg'));
  conferir('foto apagada de propósito', existsSync(join(caminhos.midias, '1', 'foto1.jpg')), false);

  const rest = await restaurarBackup(b1.arquivo, caminhos);
  console.log('  restaurou', rest.arquivosRestaurados, 'arquivo(s)');
  console.log('  cópia de segurança em', rest.copiaDeSeguranca?.split('/').pop());
  conferir('guardou o banco anterior antes de trocar', rest.copiaDeSeguranca !== null, true);
  conferir('a foto voltou', existsSync(join(caminhos.midias, '1', 'foto1.jpg')), true);
  conferir(
    'a foto3, que não estava no backup, foi preservada',
    existsSync(join(caminhos.midias, '1', 'foto3.jpg')),
    true,
  );

  const depois = new Database(caminhos.arquivoDb, { readonly: true });
  const nomes = depois.prepare('select nome from clientes order by nome').all() as {
    nome: string;
  }[];
  console.log('  clientes depois de restaurar:', nomes.map((n) => n.nome).join(', '));
  conferir('voltou ao estado do backup: só 1 cliente', nomes.length, 1);
  conferir('e é o certo', nomes[0]!.nome, 'Maria Souza');
  conferir(
    'integridade do banco restaurado',
    depois.pragma('integrity_check', { simple: true }),
    'ok',
  );
  depois.close();

  console.log('\n## Recusa arquivo que não é backup');
  const lixo = join(base, 'qualquer.zip');
  writeFileSync(lixo, randomBytes(200));
  try {
    await restaurarBackup(lixo, caminhos);
    falhas++;
    console.log('  FALHOU devia ter recusado');
  } catch (e) {
    console.log(`  ok   recusou -> "${(e as Error).message}"`);
  }

  console.log(falhas === 0 ? '\n>>> TUDO OK\n' : `\n>>> ${falhas} FALHA(S)\n`);
  app.exit(falhas === 0 ? 0 : 1);
}

// Roda como app Electron de verdade (ver o runner): sem janela nenhuma, o
// Electron encerraria sozinho, e o main() precisa do app pronto.
app.on('window-all-closed', () => {});
void app.whenReady().then(() =>
  main().catch((erro: unknown) => {
    console.error('\n>>> ERRO NAO TRATADO:', erro);
    app.exit(1);
  }),
);
