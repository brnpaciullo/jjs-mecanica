import type { ReactNode } from 'react';

export interface PaginaProps {
  titulo: string;
  acoes?: ReactNode;
  children: ReactNode;
}

/** Moldura comum das telas: título grande à esquerda, ações à direita. */
export function Pagina({ titulo, acoes, children }: PaginaProps) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-8 py-7">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-titulo text-4xl text-jjs-preto">{titulo}</h1>
        {acoes ? <div className="flex items-center gap-3">{acoes}</div> : null}
      </header>
      {children}
    </div>
  );
}
