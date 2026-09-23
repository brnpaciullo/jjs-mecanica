import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { App } from '../src/renderer/src/App.js';

// Sem isto o React 19 avisa que o ambiente não suporta act().
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Renderiza a tela de verdade num DOM de mentira, para pegar erro de
 * renderização — o tipo de falha que deixa a janela em branco e que nenhum
 * teste de lógica encontra.
 *
 * Roda nos dois mundos: dentro do Electron (com a ponte `window.jjs`) e no
 * navegador do `dev:web` (sem ponte nenhuma).
 */

function pontefalsa() {
  const vazio = () => Promise.resolve([]);
  return {
    info: () =>
      Promise.resolve({
        versao: '0.0.1',
        plataforma: 'linux',
        ehWindows: false,
        empacotado: false,
        pastaDados: '/tmp',
      }),
    caminhos: () => Promise.resolve({}),
    config: {
      ler: () => Promise.resolve({ id: 1, nome: 'JJS', validadeOrcamentoDias: 7 }),
      salvar: vazio,
    },
    usuarios: { listar: vazio, criar: vazio, atualizar: vazio },
    clientes: {
      listar: vazio,
      buscar: () => Promise.resolve(null),
      criar: vazio,
      atualizar: vazio,
      arquivar: vazio,
    },
    veiculos: {
      listar: vazio,
      buscar: () => Promise.resolve(null),
      doCliente: vazio,
      porPlaca: () => Promise.resolve(null),
      criar: vazio,
      atualizar: vazio,
      arquivar: vazio,
    },
    catalogo: { listar: vazio, sugerir: vazio, criar: vazio, atualizar: vazio, arquivar: vazio },
    ordens: {
      quadro: vazio,
      historico: vazio,
      criar: vazio,
      abrir: () => Promise.resolve(null),
      atualizar: vazio,
      mudarStatus: vazio,
      doVeiculo: vazio,
      doCliente: vazio,
    },
    itens: {
      adicionar: vazio,
      atualizar: vazio,
      remover: vazio,
      reordenar: vazio,
      aprovarTodos: vazio,
    },
    busca: { global: vazio },
  };
}

async function montar() {
  const erros: unknown[] = [];
  const spy = vi.spyOn(console, 'error').mockImplementation((...args) => erros.push(args));

  const div = document.createElement('div');
  document.body.appendChild(div);
  const raiz = createRoot(div, { onUncaughtError: (erro) => erros.push(erro) });

  await act(async () => {
    raiz.render(<App />);
  });

  const html = div.innerHTML;
  await act(async () => raiz.unmount());
  spy.mockRestore();
  div.remove();

  return { html, erros };
}

afterEach(() => {
  // @ts-expect-error limpando a ponte entre os casos
  delete window.jjs;
  window.location.hash = '';
});

describe('a tela abre', () => {
  it('dentro do Electron, com a ponte', async () => {
    // @ts-expect-error ponte de mentira
    window.jjs = pontefalsa();
    const { html, erros } = await montar();

    expect(erros, `erros ao renderizar:\n${JSON.stringify(erros, null, 2)}`).toEqual([]);
    expect(html).toContain('Carros na oficina');
    expect(html.length).toBeGreaterThan(500);
  });

  it('no navegador, sem a ponte (dev:web) — não pode ficar em branco', async () => {
    // Mesmo caminho do main.tsx: instala a ponte de prévia antes de renderizar.
    const { instalarPonteDePrevia } = await import('../src/renderer/src/ponte.js');
    instalarPonteDePrevia();

    const { html, erros } = await montar();

    expect(erros, `erros ao renderizar:\n${JSON.stringify(erros, null, 2)}`).toEqual([]);
    expect(html).toContain('Carros na oficina');
    expect(html).not.toContain('Essa tela travou');
  });
});

describe('erro de tela não vira janela em branco', () => {
  it('mostra a mensagem do limite de erro', async () => {
    const { LimiteDeErro } = await import('../src/renderer/src/componentes/LimiteDeErro.js');

    function Quebrada(): never {
      throw new Error('erro de propósito');
    }

    const erros: unknown[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const div = document.createElement('div');
    document.body.appendChild(div);
    const raiz = createRoot(div, { onUncaughtError: (e) => erros.push(e) });

    await act(async () => {
      raiz.render(
        <LimiteDeErro>
          <Quebrada />
        </LimiteDeErro>,
      );
    });

    expect(div.innerHTML).toContain('Essa tela travou');
    expect(div.innerHTML).toContain('erro de propósito');

    await act(async () => raiz.unmount());
    spy.mockRestore();
    div.remove();
  });
});
