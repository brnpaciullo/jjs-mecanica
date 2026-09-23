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
const bundle = join(raiz, 'node_modules', '.jjs-fluxo.cjs');

await build({
  entryPoints: [join(raiz, 'scripts', 'verificar-fluxo.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  // Nativo: precisa ser resolvido em tempo de execução, nunca empacotado.
  external: ['better-sqlite3'],
  outfile: bundle,
  logLevel: 'error',
});

const executar = spawnSync(require('electron'), [bundle], {
  stdio: 'inherit',
  cwd: raiz,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
});

process.exit(executar.status ?? 1);
