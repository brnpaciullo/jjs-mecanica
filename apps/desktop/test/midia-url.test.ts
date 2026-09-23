// @vitest-environment node
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { urlDaMidia } from '../src/renderer/src/midia.js';

// O protocolo importa o `electron`, que não existe no vitest. Só a função de
// caminho interessa aqui, e ela não toca em nada do Electron.
vi.mock('electron', () => ({ protocol: {}, net: {} }));
const { resolverCaminho } = await import('../src/main/midias/protocolo.js');

/**
 * A foto aparecia em branco na tela do balcão: o main monta `/midias/...`, que
 * é o endereço no servidor da LAN, e a tela roda em `file://`, onde isso
 * aponta para a raiz do disco. Estes testes seguram as duas pontas da correção.
 */
describe('a URL que a tela do balcão consegue carregar', () => {
  it('troca o endereço da LAN pelo protocolo do app', () => {
    expect(urlDaMidia('/midias/12/foto-1790.jpg')).toBe('jjs-midia://arquivo/12/foto-1790.jpg');
  });

  it('serve também a caixa de entrada, que fica numa subpasta', () => {
    expect(urlDaMidia('/midias/_inbox/foto-1790.jpg')).toBe(
      'jjs-midia://arquivo/_inbox/foto-1790.jpg',
    );
  });

  it('escapa espaço e acento, senão a URL quebra no meio do nome', () => {
    expect(urlDaMidia('/midias/3/motor traseiro é assim.jpg')).toBe(
      'jjs-midia://arquivo/3/motor%20traseiro%20%C3%A9%20assim.jpg',
    );
  });

  it('não mexe no que já é uma URL de verdade', () => {
    expect(urlDaMidia('https://exemplo.com/x.jpg')).toBe('https://exemplo.com/x.jpg');
  });

  it('sem mídia, não vira src="undefined" — o <img> não pede nada', () => {
    expect(urlDaMidia(null)).toBeUndefined();
    expect(urlDaMidia('')).toBeUndefined();
  });
});

describe('o protocolo não serve nada fora da pasta de mídias', () => {
  const PASTA = join('/home', 'oficina', 'midias');

  it('resolve um arquivo normal', () => {
    expect(resolverCaminho(PASTA, 'jjs-midia://arquivo/12/foto.jpg')).toBe(
      join(PASTA, '12', 'foto.jpg'),
    );
  });

  it('desfaz o escape do nome com espaço', () => {
    expect(resolverCaminho(PASTA, 'jjs-midia://arquivo/3/motor%20traseiro.jpg')).toBe(
      join(PASTA, '3', 'motor traseiro.jpg'),
    );
  });

  /**
   * O `..` simples nem chega aqui: o parser de URL normaliza o caminho antes.
   * O que passa por ele é a barra escapada — `%2f` vira `/` só no decode, já
   * depois da normalização. É o furo clássico, e é o que o guarda pega.
   */
  it('recusa a barra escondida atrás de %2f, que escapa da pasta', () => {
    expect(resolverCaminho(PASTA, 'jjs-midia://arquivo/..%2fjjs.db')).toBeNull();
    expect(resolverCaminho(PASTA, 'jjs-midia://arquivo/12%2f..%2f..%2fjjs.db')).toBeNull();
  });

  it('recusa URL sem autoridade, onde o caminho relativo sobrevive', () => {
    expect(resolverCaminho(PASTA, 'jjs-midia:../jjs.db')).toBeNull();
  });

  it('recusa a pasta irmã de nome parecido — startsWith sem a barra deixaria passar', () => {
    expect(resolverCaminho(PASTA, 'jjs-midia://arquivo/..%2f..%2fmidias-secretas/x.jpg')).toBeNull();
  });

  it('o .. que o parser normaliza continua dentro da pasta, e isso está certo', () => {
    // Não é escape: vira /jjs.db, que o join põe dentro da pasta de mídias.
    expect(resolverCaminho(PASTA, 'jjs-midia://arquivo/../jjs.db')).toBe(join(PASTA, 'jjs.db'));
  });
});
