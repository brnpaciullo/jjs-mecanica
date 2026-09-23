/**
 * Eventos internos da tela. Evita passar callback por cinco níveis de
 * componente só para o botão da lateral abrir a busca que mora no Layout.
 */
export const ABRIR_BUSCA = 'jjs:abrir-busca';

export function pedirBusca(): void {
  document.dispatchEvent(new CustomEvent(ABRIR_BUSCA));
}
