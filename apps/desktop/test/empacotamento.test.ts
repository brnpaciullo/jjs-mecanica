// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guarda contra instalador incompleto.
 *
 * A v0.0.4 saiu **sem o app do mecânico**: o CI chamava o script do workspace
 * desktop, cujo `build` só constrói o Electron. O `extraResources` não reclama
 * de uma pasta de origem que não existe, então o instalador ficou pronto,
 * passou na conferência do release e só quebrou no celular do mecânico — com
 * um 404 depois de parear.
 */
const raiz = join(import.meta.dirname, '..', '..', '..');
const config = readFileSync(join(raiz, 'apps/desktop/electron-builder.yml'), 'utf8');

function scripts(caminho: string): Record<string, string> {
  return JSON.parse(readFileSync(join(raiz, caminho), 'utf8')).scripts ?? {};
}

describe('o instalador leva tudo que o app precisa em produção', () => {
  it('o build da raiz constrói o app do mecânico antes do desktop', () => {
    const build = scripts('package.json').build ?? '';
    expect(build, 'sem isto o instalador sai sem o app do celular').toContain('@jjs/mobile');

    const ordemMobile = build.indexOf('@jjs/mobile');
    const ordemDesktop = build.indexOf('@jjs/desktop');
    expect(ordemMobile, 'o app do celular precisa vir antes').toBeLessThan(ordemDesktop);
  });

  it('empacotar e publicar não constroem — quem constrói é a raiz', () => {
    const desktop = scripts('apps/desktop/package.json');
    for (const nome of ['empacotar:win', 'publicar:win']) {
      expect(desktop[nome], `${nome} não pode chamar o build do próprio workspace`).not.toContain(
        'npm run build',
      );
    }
  });

  it('o workflow constrói pela raiz e confere o resultado', () => {
    const fluxo = readFileSync(join(raiz, '.github/workflows/release.yml'), 'utf8');
    expect(fluxo).toMatch(/run:\s*npm run build\s*$/m);
    expect(fluxo, 'precisa falhar se o app do celular não foi construído').toContain(
      'apps/mobile/dist/index.html',
    );
  });

  it('o instalador inclui o app do mecânico, as migrations e as fontes', () => {
    expect(config, 'sem isto o celular pareia e cai num 404').toContain('../mobile/dist');
    expect(config, 'sem isto o banco não migra em produção').toContain('migrations');
    expect(config, 'sem isto o orçamento sai na fonte errada').toContain('recursos/fontes/*.woff2');
    expect(config, 'sem isto a bandeja fica sem ícone').toContain('recursos/*.png');
  });

  it('as fontes do PDF estão no repositório', () => {
    for (const fonte of [
      'barlow-latin-400-normal.woff2',
      'barlow-latin-700-normal.woff2',
      'barlow-condensed-latin-700-normal.woff2',
    ]) {
      expect(
        existsSync(join(raiz, 'apps/desktop/recursos/fontes', fonte)),
        `${fonte} não está no repositório`,
      ).toBe(true);
    }
  });
});
