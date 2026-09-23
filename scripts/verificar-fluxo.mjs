/**
 * Runner do teste de fumaça. Empacota o script TypeScript e roda sob o runtime
 * do Electron, que é onde o better-sqlite3 consegue ser carregado.
 *
 * Em Node puro (vitest) o módulo nativo não abre: ele foi compilado para o ABI
 * do Electron pelo `install-app-deps`. Por isso este caminho existe.
 *
 * Feito em .mjs, e não direto no npm script, para a variável de ambiente
 * funcionar igual no Linux e no Windows.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
// Qual script verificar; por padrão o do fluxo do balcão.
const alvo = process.argv[2] ?? 'verificar-fluxo';

/**
 * Alguns scripts tocam módulos do processo main que importam `electron` de
 * verdade (log, dialog). Nesses casos não dá para usar ELECTRON_RUN_AS_NODE:
 * ali `require('electron')` devolve o caminho do binário, não a API. Rodamos
 * o Electron de verdade, sem janela, com a plataforma headless do Chromium.
 */
const precisaDoElectron = process.argv.includes('--electron');
const bundle = join(raiz, 'node_modules', `.jjs-${alvo}.cjs`);

await build({
  entryPoints: [join(raiz, 'scripts', `${alvo}.ts`)],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  // Nativo: precisa ser resolvido em tempo de execução, nunca empacotado.
  external: ['better-sqlite3', 'archiver', 'yauzl', 'electron'],
  outfile: bundle,
  logLevel: 'error',
});

const argumentos = precisaDoElectron
  ? [bundle, '--no-sandbox', '--ozone-platform=headless', '--disable-gpu']
  : [bundle];

const ambiente = { ...process.env };
if (!precisaDoElectron) ambiente.ELECTRON_RUN_AS_NODE = '1';

const executar = spawnSync(require('electron'), argumentos, {
  stdio: 'inherit',
  cwd: raiz,
  env: ambiente,
});

process.exit(executar.status ?? 1);
