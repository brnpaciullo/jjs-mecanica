import type { WASocket } from '@whiskeysockets/baileys';

export interface GrupoDoWhatsApp {
  jid: string;
  nome: string;
  participantes: number;
}

/**
 * Os grupos de que o número da oficina participa.
 *
 * Vem tudo de uma vez porque o WhatsApp não tem busca no servidor: quem filtra
 * por nome é a tela. Uma conta de oficina costuma estar em dezenas de grupos
 * (fornecedor, família, bairro), então a lista sai ordenada por nome para o
 * filtro da tela ter algo estável em cima do que trabalhar.
 */
export async function listarGrupos(socket: WASocket): Promise<GrupoDoWhatsApp[]> {
  const todos = await socket.groupFetchAllParticipating();

  return Object.values(todos)
    .map((grupo) => ({
      jid: grupo.id,
      // Grupo sem assunto definido é raro, mas existe — e some da lista se o
      // nome vier vazio, porque não haveria o que digitar no filtro.
      nome: grupo.subject?.trim() || 'Grupo sem nome',
      participantes: grupo.participants?.length ?? 0,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
