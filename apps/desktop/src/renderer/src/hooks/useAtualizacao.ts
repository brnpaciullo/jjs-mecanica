import { useEffect, useState } from 'react';
import type { EstadoAtualizacao } from '../../../main/atualizacao.js';
import { EH_PREVIA_NO_NAVEGADOR } from '../ponte.js';

const INICIAL: EstadoAtualizacao = {
  situacao: 'ociosa',
  versaoInstalada: '',
  versaoNova: null,
  progresso: 0,
  aviso: null,
};

/** Andamento da atualização, empurrado pelo main enquanto o download acontece. */
export function useAtualizacao(): EstadoAtualizacao {
  const [estado, setEstado] = useState<EstadoAtualizacao>(INICIAL);

  useEffect(() => {
    if (EH_PREVIA_NO_NAVEGADOR) return;

    let vivo = true;
    window.jjs.atualizacao
      .estado()
      .then((atual) => vivo && setEstado(atual))
      .catch(() => undefined);

    const parar = window.jjs.atualizacao.aoMudar((novo) => {
      if (vivo) setEstado(novo);
    });

    return () => {
      vivo = false;
      parar();
    };
  }, []);

  return estado;
}
