import { networkInterfaces } from 'node:os';

export const PORTA_LAN = 4570;

export interface EnderecoDaOficina {
  /** IP na rede local, ou null se o notebook não estiver em rede nenhuma. */
  ip: string | null;
  porta: number;
  /** Endereço completo para digitar ou virar QR code. */
  url: string | null;
  /** Nome da interface, para a tela poder explicar (Wi-Fi, cabo...). */
  interfaceUsada: string | null;
}

/**
 * Descobre o IP do notebook na rede da oficina.
 *
 * Tem que ser o endereço que o celular alcança pelo Wi-Fi — não `localhost`,
 * que no celular apontaria para o próprio celular. Interfaces virtuais (Docker,
 * WSL, VPN) são descartadas: elas existem na máquina mas nenhum celular chega
 * nelas, e um QR com esse IP simplesmente não conecta.
 */
export function descobrirEndereco(): EnderecoDaOficina {
  const interfaces = networkInterfaces();
  const candidatos: { nome: string; ip: string; nota: number }[] = [];

  for (const [nome, enderecos] of Object.entries(interfaces)) {
    for (const endereco of enderecos ?? []) {
      if (endereco.family !== 'IPv4' || endereco.internal) continue;

      const ip = endereco.address;
      if (ehVirtual(nome, ip)) continue;

      candidatos.push({ nome, ip, nota: pontuar(nome, ip) });
    }
  }

  candidatos.sort((a, b) => b.nota - a.nota);
  const melhor = candidatos[0];

  return {
    ip: melhor?.ip ?? null,
    porta: PORTA_LAN,
    url: melhor ? `http://${melhor.ip}:${PORTA_LAN}` : null,
    interfaceUsada: melhor?.nome ?? null,
  };
}

/** Interfaces que existem na máquina mas que nenhum celular alcança. */
function ehVirtual(nome: string, ip: string): boolean {
  const nomesVirtuais =
    /^(docker|br-|veth|virbr|vmnet|vEthernet|wsl|tun|tap|utun|ZeroTier|Hyper-V)/i;
  if (nomesVirtuais.test(nome)) return true;

  // Faixas que o Docker e o WSL costumam usar; a rede de uma oficina é
  // 192.168.x.x ou 10.x.x.x vinda do roteador.
  if (/^172\.(1[7-9]|2\d|3[01])\./.test(ip)) return true;
  // Link-local: o Windows inventa isso quando o DHCP falha.
  if (ip.startsWith('169.254.')) return true;

  return false;
}

/** Prefere Wi-Fi e faixas domésticas, que é onde o celular do mecânico está. */
function pontuar(nome: string, ip: string): number {
  let nota = 0;
  if (/wi-?fi|wlan|wlp|wireless/i.test(nome)) nota += 10;
  if (/eth|enp|ethernet/i.test(nome)) nota += 5;
  if (ip.startsWith('192.168.')) nota += 8;
  if (ip.startsWith('10.')) nota += 4;
  return nota;
}
