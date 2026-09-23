import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn.js';

type Variante = 'principal' | 'secundario' | 'discreto' | 'perigo';
type Tamanho = 'normal' | 'grande';

export interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamanho?: Tamanho;
  icone?: ReactNode;
}

/**
 * Botao principal = fundo amarelo com texto preto. Nunca texto amarelo sobre
 * branco: nao passa em contraste.
 * Altura minima de 48px em tudo, porque a mesma interface e usada no toque.
 */
const VARIANTES: Record<Variante, string> = {
  principal:
    'bg-jjs-amarelo text-jjs-preto hover:bg-jjs-amarelo-escuro active:bg-jjs-amarelo-escuro',
  secundario:
    'bg-jjs-branco text-jjs-preto border border-jjs-borda hover:bg-jjs-papel active:bg-jjs-papel',
  discreto: 'bg-transparent text-jjs-preto hover:bg-black/5 active:bg-black/10',
  perigo: 'bg-jjs-vermelho text-white hover:brightness-95 active:brightness-90',
};

const TAMANHOS: Record<Tamanho, string> = {
  normal: 'min-h-toque px-4 text-base',
  grande: 'min-h-14 px-6 text-lg',
};

export function Botao({
  variante = 'secundario',
  tamanho = 'normal',
  icone,
  className,
  children,
  type = 'button',
  ...resto
}: BotaoProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-campo font-semibold',
        'transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTES[variante],
        TAMANHOS[tamanho],
        className,
      )}
      {...resto}
    >
      {icone}
      {children}
    </button>
  );
}
