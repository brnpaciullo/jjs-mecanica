import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Configuracao da tela do balcao, isolada num arquivo proprio para servir a
 * dois donos sem duplicar nada:
 *  - o electron.vite.config.ts importa daqui a parte `renderer`;
 *  - o `npm run dev:web` roda este arquivo direto no Vite, abrindo so a tela
 *    no navegador (o --rendererOnly do electron-vite 5 nao serve: ele pula o
 *    rebuild do main mas sobe o Electron do mesmo jeito).
 */

const RAIZ = resolve(__dirname, 'src/renderer');

/**
 * O app roda offline: nada pode ser buscado de fora.
 * `file:` entra junto de 'self' porque a tela empacotada e carregada por
 * file://, onde a origem e nula e 'self' sozinho nao casa com as fontes e o
 * logo. Codigo remoto continua bloqueado, que e o ponto.
 *
 * `jjs-midia:` e o protocolo que o main registra para servir as fotos e os
 * videos da OS (ver src/main/midias/protocolo.ts). Precisa aparecer em
 * `media-src` tambem: sem essa linha o video herda o `default-src` e o player
 * abre mudo e preto, sem dizer por que.
 */
const CSP = [
  "default-src 'self' file:",
  "script-src 'self' file:",
  "style-src 'self' 'unsafe-inline' file:",
  "img-src 'self' data: blob: file: jjs-midia:",
  "media-src 'self' file: jjs-midia:",
  "font-src 'self' data: file:",
  "connect-src 'self' file:",
].join('; ');

/** So no build: em dev o Vite injeta script inline para o HMR. */
function cspNoBuild(): Plugin {
  return {
    name: 'jjs-csp',
    apply: 'build',
    transformIndexHtml(html: string) {
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

export default defineConfig({
  root: RAIZ,
  resolve: {
    alias: {
      '@renderer': resolve(RAIZ, 'src'),
    },
  },
  server: {
    // Escuta em todas as interfaces para dar para abrir a tela de outra
    // maquina da rede. Vale so em desenvolvimento: o app empacotado carrega
    // por file:// e nunca sobe este servidor.
    host: true,
  },
  plugins: [react(), tailwindcss(), cspNoBuild()],
  build: {
    // O electron-vite nao minifica por padrao. A tela vale a pena minificar;
    // main e preload ficam legiveis de proposito, para o stack trace do
    // "Exportar diagnostico" apontar para codigo que da para ler.
    minify: 'esbuild',
    rollupOptions: {
      input: { index: resolve(RAIZ, 'index.html') },
    },
  },
});
