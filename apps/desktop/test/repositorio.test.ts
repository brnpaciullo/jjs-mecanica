// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guarda contra um erro que já aconteceu e é silencioso: o `.gitignore` tinha
 * `midias/` para proteger as fotos da oficina, e isso também excluiu
 * `apps/desktop/src/main/midias/` — código-fonte.
 *
 * O projeto compilava aqui (os arquivos estavam no disco) e quebrava no CI
 * (não estavam no repositório). Só se descobriu ao publicar uma versão.
 */
const raiz = join(import.meta.dirname, '..', '..', '..');

function fontes(dir: string): string[] {
  const achados: string[] = [];

  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'out', '.git', '.vite', 'release'].includes(entrada.name)) {
      continue;
    }
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) achados.push(...fontes(caminho));
    else if (/\.(ts|tsx|css|json|yml|html)$/.test(entrada.name)) achados.push(caminho);
  }

  return achados;
}

describe('o repositório contém tudo que o projeto precisa', () => {
  it('nenhum arquivo de código está sendo ignorado pelo git', () => {
    const arquivos = [
      ...fontes(join(raiz, 'apps')),
      ...fontes(join(raiz, 'packages')),
      ...fontes(join(raiz, 'scripts')),
    ];

    expect(arquivos.length).toBeGreaterThan(50);

    // check-ignore sai com 0 e lista o que está ignorado; 1 significa nenhum.
    let ignorados: string[] = [];
    try {
      const saida = execFileSync('git', ['check-ignore', '--stdin'], {
        cwd: raiz,
        input: arquivos.join('\n'),
        encoding: 'utf8',
      });
      ignorados = saida.trim().split('\n').filter(Boolean);
    } catch {
      // saída 1 = nada ignorado, que é o esperado
    }

    expect(
      ignorados.map((f) => relative(raiz, f)),
      'estes arquivos existem no disco mas nunca chegariam ao repositório',
    ).toEqual([]);
  });

  it('nenhum arquivo de código está sem ser versionado', () => {
    const naoVersionados = execFileSync(
      'git',
      ['ls-files', '--others', '--exclude-standard', 'apps', 'packages', 'scripts'],
      { cwd: raiz, encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter((f) => /\.(ts|tsx|css|yml)$/.test(f));

    expect(naoVersionados, 'faltou dar git add nestes arquivos').toEqual([]);
  });
});
