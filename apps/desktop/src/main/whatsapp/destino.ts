import { formatarTelefone, paraWhatsApp } from '@jjs/core';

/**
 * Problema com o número em si, não com a conexão. Não adianta cair no plano B
 * do wa.me: o link levaria para o mesmo número que não existe. Quem precisa
 * agir é quem está no balcão, corrigindo o cadastro.
 */
export class ErroDeDestino extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeDestino';
  }
}

export interface ResultadoOnWhatsApp {
  jid: string;
  exists: boolean;
}

/**
 * Escolhe o JID a partir da resposta do servidor.
 *
 * **Por que não montar `numero@s.whatsapp.net` na mão:** no Brasil o WhatsApp
 * guarda muitos números **sem o nono dígito**. Mandar para
 * `5541999887766@s.whatsapp.net` quando a conta real é `554199887766` não dá
 * erro — o servidor aceita e a mensagem simplesmente não chega em lugar
 * nenhum. Era por isso que o sistema dizia "enviado" e o cliente não recebia.
 *
 * Quem sabe o JID certo é o servidor, e é ele que o `onWhatsApp` pergunta.
 */
export function escolherJid(resposta: ResultadoOnWhatsApp[] | undefined, telefone: string): string {
  const numero = paraWhatsApp(telefone);

  if (!resposta || resposta.length === 0) {
    // Falha de consulta: pode ser a conexão. Vale oferecer o plano B.
    throw new Error(
      'Não consegui confirmar esse número no WhatsApp agora. ' +
        'Verifique a conexão em Configurações > WhatsApp e tente de novo.',
    );
  }

  const encontrado = resposta.find((r) => r.exists);
  if (!encontrado) {
    throw new ErroDeDestino(
      `O número ${formatarTelefone(numero)} não tem WhatsApp. ` +
        'Confira o telefone no cadastro do cliente.',
    );
  }

  return encontrado.jid;
}
