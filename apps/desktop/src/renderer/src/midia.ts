/**
 * A URL de uma mídia, do jeito que a tela do balcão consegue carregar.
 *
 * O main guarda o caminho relativo e monta `/midias/...`, que é o endereço no
 * servidor da LAN — é o que o celular do mecânico usa. A tela do balcão roda
 * em `file://`, onde esse mesmo endereço aponta para a raiz do disco e a
 * imagem sai em branco. Aqui ela é reescrita para o protocolo que o main
 * registra em `midias/protocolo.ts`.
 */
const PREFIXO_LAN = '/midias/';

export function urlDaMidia(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (!url.startsWith(PREFIXO_LAN)) return url;

  const relativo = url.slice(PREFIXO_LAN.length).split('/').map(encodeURIComponent).join('/');
  return `jjs-midia://arquivo/${relativo}`;
}
