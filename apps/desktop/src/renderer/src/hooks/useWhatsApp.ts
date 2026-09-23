import { useEffect, useState } from 'react';
import type { EstadoWhatsApp } from '../../../main/whatsapp/estado.js';
import { EH_PREVIA_NO_NAVEGADOR } from '../ponte.js';

const DESCONECTADO: EstadoWhatsApp = {
  situacao: 'desconectado',
  qrDataUri: null,
  numero: null,
  nome: null,
  aviso: null,
  naFila: 0,
};

/**
 * Estado da conexão do WhatsApp, em tempo real.
 *
 * O main empurra cada mudança (QR novo, queda, reconexão) em vez de a tela
 * ficar perguntando: o QR expira em segundos e precisa ser trocado na hora.
 */
export function useWhatsApp(): EstadoWhatsApp {
  const [estado, setEstado] = useState<EstadoWhatsApp>(DESCONECTADO);

  useEffect(() => {
    if (EH_PREVIA_NO_NAVEGADOR) return;

    let vivo = true;
    window.jjs.whatsapp
      .estado()
      .then((atual) => vivo && setEstado(atual))
      .catch(() => undefined);

    const parar = window.jjs.whatsapp.aoMudar((novo) => {
      if (vivo) setEstado(novo);
    });

    return () => {
      vivo = false;
      parar();
    };
  }, []);

  return estado;
}
