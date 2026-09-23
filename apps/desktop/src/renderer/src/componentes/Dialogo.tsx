import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Botao } from '@jjs/ui';

export interface DialogoProps {
  titulo: string;
  aberto: boolean;
  aoFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: 'normal' | 'larga';
}

/** Janela sobreposta. Fecha com Esc e clicando fora. */
export function Dialogo({
  titulo,
  aberto,
  aoFechar,
  children,
  rodape,
  largura = 'normal',
}: DialogoProps) {
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    // Foca a janela para o teclado já funcionar dentro dela.
    caixa.current?.focus();
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
    >
      <div
        ref={caixa}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={
          'my-8 w-full rounded-card bg-jjs-branco shadow-xl outline-none ' +
          (largura === 'larga' ? 'max-w-3xl' : 'max-w-xl')
        }
      >
        <header className="flex items-center justify-between border-b border-jjs-borda px-5 py-4">
          <h2 className="font-titulo text-2xl text-jjs-preto">{titulo}</h2>
          <Botao
            variante="discreto"
            onClick={aoFechar}
            aria-label="Fechar"
            className="min-h-10 px-2"
          >
            <X size={22} />
          </Botao>
        </header>

        <div className="px-5 py-5">{children}</div>

        {rodape ? (
          <footer className="flex justify-end gap-3 border-t border-jjs-borda px-5 py-4">
            {rodape}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
