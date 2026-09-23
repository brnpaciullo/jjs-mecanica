import { useEffect, useState } from 'react';
import { EH_PREVIA_NO_NAVEGADOR } from '../ponte.js';

export interface InfoApp {
  versao: string;
  plataforma: string;
  ehWindows: boolean;
  empacotado: boolean;
  pastaDados: string;
}

/** A ponte do preload só existe dentro do Electron, nunca num navegador comum. */
export function temPonte(): boolean {
  return !EH_PREVIA_NO_NAVEGADOR;
}

/**
 * Lê do processo main quem somos e onde os dados da oficina estão guardados.
 *
 * Devolve `null` quando a ponte não existe — que é o caso ao abrir a tela num
 * navegador (`npm run dev:web`). Quem chama precisa dizer isso na tela em vez
 * de fingir que carregou: a ponte faltando dentro do Electron é defeito de
 * verdade e não pode passar despercebido.
 */
export function useInfoApp(): InfoApp | null {
  const [info, setInfo] = useState<InfoApp | null>(null);

  useEffect(() => {
    if (!temPonte()) {
      console.warn(
        'Sem conexão com o processo principal: a tela está sendo exibida fora do Electron.',
      );
      return;
    }

    let vivo = true;
    window.jjs
      .info()
      .then((resposta: InfoApp) => {
        if (vivo) setInfo(resposta);
      })
      .catch((erro: unknown) => console.error('Não consegui ler os dados do sistema', erro));
    return () => {
      vivo = false;
    };
  }, []);

  return info;
}
