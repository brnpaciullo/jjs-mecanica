import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

/** Barra do topo, fixa. O botão voltar é grande porque é o mais usado. */
export function Cabecalho({
  titulo,
  voltarPara,
  acao,
}: {
  titulo: string;
  voltarPara?: string;
  acao?: ReactNode;
}) {
  const navegar = useNavigate();

  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center gap-2 bg-jjs-preto px-2 text-white">
      {voltarPara ? (
        <button
          type="button"
          onClick={() => navegar(voltarPara)}
          aria-label="Voltar"
          className="flex size-12 items-center justify-center rounded-campo active:bg-jjs-grafite"
        >
          <ChevronLeft size={28} />
        </button>
      ) : (
        <span className="w-2" />
      )}
      <h1 className="flex-1 truncate font-titulo text-2xl">{titulo}</h1>
      {acao}
    </header>
  );
}
