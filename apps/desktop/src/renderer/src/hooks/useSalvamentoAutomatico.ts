import { useCallback, useEffect, useRef, useState } from 'react';
import { mensagemDeErro } from '../erro.js';

export type EstadoSalvamento = 'parado' | 'digitando' | 'salvando' | 'salvo' | 'erro';

export interface Salvamento {
  estado: EstadoSalvamento;
  erro: string | null;
  /** Chame a cada tecla: agenda o salvamento. */
  agendar: (valor: unknown) => void;
  /** Força o salvamento agora (ao sair do campo, ao fechar a tela). */
  agora: () => void;
}

/**
 * Salvamento automático das telas de edição: ninguém na oficina deveria
 * perder o que digitou por esquecer de clicar em salvar.
 *
 * Espera uma pausa na digitação antes de gravar, e grava na hora quando o
 * campo perde o foco. O indicador discreto de "Salvo" vem do `estado`.
 */
export function useSalvamentoAutomatico(
  salvar: (valor: never) => Promise<unknown>,
  esperaMs = 700,
): Salvamento {
  const [estado, setEstado] = useState<EstadoSalvamento>('parado');
  const [erro, setErro] = useState<string | null>(null);

  // Atribuição dentro de um efeito: mexer em ref durante a renderização
  // quebra o modo concorrente do React.
  const salvarRef = useRef(salvar);
  useEffect(() => {
    salvarRef.current = salvar;
  });

  const pendente = useRef<unknown>(undefined);
  const temPendente = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gravar = useCallback(async () => {
    if (!temPendente.current) return;
    const valor = pendente.current;
    temPendente.current = false;

    setEstado('salvando');
    try {
      await salvarRef.current(valor as never);
      setEstado('salvo');
      setErro(null);
    } catch (causa) {
      setEstado('erro');
      setErro(mensagemDeErro(causa));
    }
  }, []);

  const agendar = useCallback(
    (valor: unknown) => {
      pendente.current = valor;
      temPendente.current = true;
      setEstado('digitando');

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void gravar(), esperaMs);
    },
    [gravar, esperaMs],
  );

  const agora = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    void gravar();
  }, [gravar]);

  // Se a tela for fechada com algo pendente, grava antes de sumir.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (temPendente.current) void gravar();
    };
  }, [gravar]);

  return { estado, erro, agendar, agora };
}
