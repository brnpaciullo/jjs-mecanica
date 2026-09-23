// @vitest-environment node
// O esbuild precisa do Node de verdade; dentro do jsdom ele recusa rodar.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * O processo main é empacotado em **CJS** com as dependências externas. Nesse
 * formato o esbuild converte `import x from 'pacote'` com a semântica do Node:
 * o default vira o `module.exports` inteiro, não o export default do pacote.
 *
 * Para um pacote cujo default É uma função — o `makeWASocket` do Baileys — isso
 * resulta em um objeto, e o app quebra com "makeWASocket is not a function" só
 * em tempo de execução, no clique de gerar o QR code.
 *
 * Este teste reproduz o empacotamento de verdade, porque rodando em ESM (como
 * o vitest faz) o erro simplesmente não acontece e passaria batido.
 */
/**
 * O bundle precisa ficar **dentro do projeto**: o `require` de um pacote
 * externo resolve subindo a partir do arquivo, e de /tmp o node_modules não
 * seria encontrado — exatamente como acontece no app de verdade.
 */
const pasta = join(process.cwd(), 'node_modules', '.jjs-interop');
mkdirSync(pasta, { recursive: true });
afterAll(() => rmSync(pasta, { recursive: true, force: true }));

async function tiposNoBundle(codigo: string, externos: string[]): Promise<string> {
  const entrada = join(pasta, `e-${Math.random().toString(36).slice(2)}.ts`);
  const saida = entrada.replace(/\.ts$/, '.cjs');
  writeFileSync(entrada, codigo, 'utf8');

  await build({
    entryPoints: [entrada],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: externos,
    outfile: saida,
    logLevel: 'silent',
    absWorkingDir: process.cwd(),
  });

  return execFileSync(process.execPath, [saida], { encoding: 'utf8' }).trim();
}

describe('interop do bundle CJS do processo main', () => {
  it('o import NOMEADO de makeWASocket é uma função', async () => {
    const saida = await tiposNoBundle(
      `import { makeWASocket } from '@whiskeysockets/baileys';\n` +
        `console.log(typeof makeWASocket);`,
      ['@whiskeysockets/baileys'],
    );
    expect(saida).toBe('function');
  });

  it('o import DEFAULT não é — é por isso que o código usa o nomeado', async () => {
    const saida = await tiposNoBundle(
      `import makeWASocket from '@whiskeysockets/baileys';\n` + `console.log(typeof makeWASocket);`,
      ['@whiskeysockets/baileys'],
    );
    // Se um dia isto virar 'function', o Baileys mudou o empacotamento e a
    // ressalva no import de conexao.ts pode ser revista.
    expect(saida).toBe('object');
  });

  it('conexao.ts não usa o import default do Baileys', async () => {
    const { readFileSync } = await import('node:fs');
    const fonte = readFileSync('apps/desktop/src/main/whatsapp/conexao.ts', 'utf8');
    expect(fonte).not.toMatch(
      /^import\s+\w+\s*,?\s*\{?[^}]*\}?\s*from\s+'@whiskeysockets\/baileys'/m,
    );
    expect(fonte).toMatch(
      /import\s*\{[\s\S]*makeWASocket[\s\S]*\}\s*from\s*'@whiskeysockets\/baileys'/,
    );
  });
});
