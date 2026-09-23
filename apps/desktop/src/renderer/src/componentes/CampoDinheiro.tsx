import { useState } from 'react';
import { formatarDinheiroSemSimbolo, lerDinheiro } from '@jjs/core';
import { cn } from '@jjs/ui';

export interface CampoDinheiroProps {
  valorCentavos: number;
  aoMudar: (centavos: number) => void;
  aoSairDoCampo?: () => void;
  className?: string;
  'aria-label'?: string;
}

/**
 * Campo de valor em reais. Por dentro é sempre centavos inteiros; o texto só
 * existe enquanto a pessoa digita. Ao sair do campo o valor é reescrito
 * formatado, para não ficar dúvida do que foi lançado.
 */
export function CampoDinheiro({
  valorCentavos,
  aoMudar,
  aoSairDoCampo,
  className,
  ...resto
}: CampoDinheiroProps) {
  const [digitado, setDigitado] = useState<string | null>(null);

  // Enquanto a pessoa digita vale o texto dela; fora disso, o valor de fora,
  // já formatado. Derivar evita um efeito sincronizando prop com state.
  const texto = digitado ?? formatarDinheiroSemSimbolo(valorCentavos);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-jjs-texto-fraco">
        R$
      </span>
      <input
        inputMode="decimal"
        value={texto}
        className={cn(
          'min-h-toque w-full rounded-campo border border-jjs-borda bg-jjs-branco py-2 pl-9 pr-2.5',
          'text-right tabular-nums',
          className,
        )}
        onFocus={() => setDigitado(formatarDinheiroSemSimbolo(valorCentavos))}
        onChange={(e) => {
          setDigitado(e.target.value);
          const centavos = lerDinheiro(e.target.value);
          if (centavos !== null) aoMudar(centavos);
        }}
        onBlur={() => {
          const centavos = lerDinheiro(texto);
          // Campo esvaziado vira zero, em vez de manter o valor antigo escondido.
          setDigitado(null);
          aoMudar(centavos ?? 0);
          aoSairDoCampo?.();
        }}
        {...resto}
      />
    </div>
  );
}
