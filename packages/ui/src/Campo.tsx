import type { InputHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';
import { cn } from './cn.js';

export interface CampoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  rotulo: string;
  /** Mensagem que diz o que fazer, nao so que deu errado. */
  erro?: string | null;
  ajuda?: ReactNode;
}

export function Campo({ rotulo, erro, ajuda, className, ...resto }: CampoProps) {
  const id = useId();
  const idErro = `${id}-erro`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-jjs-preto">
        {rotulo}
      </label>
      <input
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? idErro : undefined}
        className={cn(
          'min-h-toque rounded-campo border bg-jjs-branco px-3 text-base',
          'placeholder:text-jjs-texto-fraco',
          erro ? 'border-jjs-vermelho' : 'border-jjs-borda',
          className,
        )}
        {...resto}
      />
      {erro ? (
        <p id={idErro} className="text-sm font-medium text-jjs-vermelho">
          {erro}
        </p>
      ) : ajuda ? (
        <p className="text-sm text-jjs-texto-fraco">{ajuda}</p>
      ) : null}
    </div>
  );
}
