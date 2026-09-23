import { join, normalize, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { net, protocol } from 'electron';
import type { CaminhosApp } from '../caminhos.js';
import { log } from '../log.js';

export const ESQUEMA_MIDIA = 'jjs-midia';

/**
 * A tela do balcão precisa mostrar as fotos, e ela roda em `file://`.
 *
 * O caminho guardado no banco é relativo, e a URL `/midias/...` que o
 * `consultar.ts` monta só existe no servidor da LAN — em `file://` ela vira
 * `file:///midias/...` e a imagem aparece em branco. Em vez de expor a pasta
 * inteira ao renderer, este protocolo serve **só** o que está dentro da pasta
 * de mídias, e nada acima dela.
 */
export function registrarEsquemaDeMidia(): void {
  // Precisa acontecer antes do app ficar pronto, senão o Chromium já decidiu
  // como tratar o esquema. `stream` é o que permite arrastar a barra do vídeo.
  protocol.registerSchemesAsPrivileged([
    {
      scheme: ESQUEMA_MIDIA,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
    },
  ]);
}

/**
 * O arquivo que a URL pede, ou null se ela tenta sair da pasta de mídias.
 *
 * `..` no meio do caminho leria qualquer arquivo do computador. O banco nunca
 * gera isso, mas quem serve arquivo confere mesmo assim — e a conferência fica
 * separada do Electron para o teste conseguir exercitá-la.
 */
export function resolverCaminho(pastaDeMidias: string, url: string): string | null {
  const raiz = normalize(pastaDeMidias);
  const dentroDaRaiz = raiz.endsWith(sep) ? raiz : raiz + sep;

  let relativo: string;
  try {
    relativo = decodeURIComponent(new URL(url).pathname).replace(/^\/+/, '');
  } catch {
    return null;
  }

  const absoluto = normalize(join(raiz, relativo));
  if (absoluto !== raiz && !absoluto.startsWith(dentroDaRaiz)) return null;
  return absoluto;
}

export function servirMidias(caminhos: CaminhosApp): void {
  protocol.handle(ESQUEMA_MIDIA, (requisicao) => {
    const absoluto = resolverCaminho(caminhos.midias, requisicao.url);

    if (absoluto === null) {
      log.error(`[mídias] caminho recusado: ${requisicao.url}`);
      return new Response('Fora da pasta de mídias', { status: 403 });
    }

    return net.fetch(pathToFileURL(absoluto).toString());
  });

  log.info(`[mídias] servindo ${ESQUEMA_MIDIA}:// de ${caminhos.midias}`);
}
