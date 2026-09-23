import { useCallback, useEffect, useRef, useState } from 'react';
import { mensagemDeErro } from '../erro.js';

export interface Consulta<T> {
  dados: T | null;
  carregando: boolean;
  erro: string | null;
  recarregar: () => void;
}

/**
 * Lê algo do processo main e mantém a tela em dia.
 *
 * `chaves` funciona como as dependências de um useEffect: mudou a busca ou o
 * id da rota, consulta de novo.
 *
 * O estado guarda a chave junto com a resposta. Assim "está carregando" é
 * deduzido (a chave da resposta é diferente da atual) em vez de virar um
 * setState dentro do efeito, que dispararia uma renderização em cascata.
 * De quebra, resposta atrasada de uma busca antiga é descartada e os dados
 * anteriores continuam na tela durante a recarga, sem piscar.
 */
export function useConsulta<T>(
  consultar: () => Promise<T>,
  chaves: readonly unknown[] = [],
): Consulta<T> {
  const [gatilho, setGatilho] = useState(0);
  const [estado, setEstado] = useState<{ chave: string; dados: T | null; erro: string | null }>({
    chave: '',
    dados: null,
    erro: null,
  });

  const chave = `${JSON.stringify(chaves)}#${gatilho}`;

  // A função vem nova a cada render de quem chama; guardá-la numa ref evita
  // exigir useCallback de todo mundo. A escrita acontece no efeito, nunca
  // durante a renderização.
  const consultarRef = useRef(consultar);
  useEffect(() => {
    consultarRef.current = consultar;
  });

  useEffect(() => {
    let valendo = true;

    // `Promise.resolve().then` em vez de chamar direto: se a função estourar
    // de forma síncrona (era o caso quando a ponte do preload não existia),
    // o erro vira uma rejeição tratada aqui em vez de derrubar a árvore do
    // React e deixar a janela em branco.
    Promise.resolve()
      .then(() => consultarRef.current())
      .then((resposta) => {
        if (valendo) setEstado({ chave, dados: resposta, erro: null });
      })
      .catch((causa: unknown) => {
        if (valendo) setEstado({ chave, dados: null, erro: mensagemDeErro(causa) });
      });

    return () => {
      valendo = false;
    };
  }, [chave]);

  const recarregar = useCallback(() => setGatilho((n) => n + 1), []);

  return {
    dados: estado.dados,
    erro: estado.erro,
    carregando: estado.chave !== chave,
    recarregar,
  };
}
