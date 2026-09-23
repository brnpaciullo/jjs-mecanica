import type { ApiJjs } from '../../preload/index.js';

const MENSAGEM_SEM_PONTE =
  'Esta tela está aberta no navegador, fora do sistema. ' +
  'Dá para conferir o visual, mas nada aqui está ligado no banco da oficina.';

/**
 * A ponte do preload só existe dentro do Electron. No navegador (`dev:web`)
 * ela não existe, e aí `window.jjs.ordens.quadro()` estourava um TypeError
 * síncrono dentro do efeito — o que derrubava a árvore inteira do React e
 * deixava a janela em branco, sem dizer nada.
 *
 * Aqui entra uma ponte de mentira que **rejeita** toda chamada com uma frase
 * clara. A tela então mostra o erro no lugar certo, cada página renderiza, e
 * dá para revisar o visual pelo navegador.
 */
export const EH_PREVIA_NO_NAVEGADOR = typeof window !== 'undefined' && !window.jjs;

function pontefalsa(): ApiJjs {
  const recusar = () => Promise.reject(new Error(MENSAGEM_SEM_PONTE));
  // Um proxy que é função e objeto ao mesmo tempo: atende tanto `jjs.info()`
  // quanto `jjs.ordens.quadro()`, sem precisar copiar a forma da API.
  const ponte: unknown = new Proxy(recusar, {
    get: () => ponte,
    apply: recusar,
  });
  return ponte as ApiJjs;
}

/** Chamar uma vez, antes de renderizar. */
export function instalarPonteDePrevia(): void {
  if (EH_PREVIA_NO_NAVEGADOR) {
    console.warn(MENSAGEM_SEM_PONTE);
    window.jjs = pontefalsa();
  }
}
