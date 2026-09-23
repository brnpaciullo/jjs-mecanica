import type { ReactNode } from 'react';

export interface EstadoVazioProps {
  icone?: ReactNode;
  titulo: string;
  /** Uma frase curta que diz o proximo passo, nunca so "sem dados". */
  descricao?: string;
  acao?: ReactNode;
}

/** Tela vazia sempre convida a fazer algo. */
export function EstadoVazio({ icone, titulo, descricao, acao }: EstadoVazioProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-jjs-borda bg-jjs-branco px-6 py-16 text-center">
      {icone ? <div className="text-jjs-texto-fraco">{icone}</div> : null}
      <h2 className="font-titulo text-2xl text-jjs-preto">{titulo}</h2>
      {descricao ? <p className="max-w-md text-jjs-texto-fraco">{descricao}</p> : null}
      {acao ? <div className="mt-2">{acao}</div> : null}
    </div>
  );
}
