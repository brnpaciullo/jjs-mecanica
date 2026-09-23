import { formatarPlaca } from '@jjs/core';
import { cn } from './cn.js';

type TamanhoPlaca = 'pequena' | 'media' | 'grande';

export interface PlacaProps {
  /** Placa normalizada, como esta no banco. O componente formata. */
  placa: string;
  tamanho?: TamanhoPlaca;
  className?: string;
}

const TAMANHOS: Record<TamanhoPlaca, { caixa: string; faixa: string; texto: string }> = {
  pequena: { caixa: 'min-w-[5.5rem]', faixa: 'h-1', texto: 'text-lg px-2 pb-0.5 pt-1' },
  media: { caixa: 'min-w-[7rem]', faixa: 'h-1.5', texto: 'text-2xl px-2.5 pb-1 pt-1' },
  grande: { caixa: 'min-w-[9rem]', faixa: 'h-2', texto: 'text-4xl px-3 pb-1 pt-1.5' },
};

/**
 * A placa e o elemento memoravel da interface: e por ela que o pessoal da
 * oficina identifica o carro. Resto da tela fica sobrio de proposito.
 * Faixa azul fina no topo lembrando a Mercosul, sem imitar a placa de verdade.
 */
export function Placa({ placa, tamanho = 'media', className }: PlacaProps) {
  const t = TAMANHOS[tamanho];

  return (
    <span
      className={cn(
        'inline-flex flex-col overflow-hidden rounded-[4px] border-2 border-jjs-preto',
        'bg-white align-middle leading-none',
        t.caixa,
        className,
      )}
    >
      <span className={cn('w-full bg-[#0c3d91]', t.faixa)} aria-hidden="true" />
      <span
        className={cn(
          'text-center font-titulo font-bold tracking-wider text-jjs-preto tabular-nums',
          t.texto,
        )}
      >
        {formatarPlaca(placa)}
      </span>
    </span>
  );
}
