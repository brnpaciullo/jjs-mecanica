import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import type { EstadoSalvamento } from '../hooks/useSalvamentoAutomatico.js';

/** Aviso discreto de que o que foi digitado já está guardado. */
export function IndicadorSalvo({
  estado,
  erro,
}: {
  estado: EstadoSalvamento;
  erro?: string | null;
}) {
  if (estado === 'parado') return null;

  if (estado === 'erro') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-jjs-vermelho">
        <AlertTriangle size={16} />
        {erro ?? 'Não consegui salvar'}
      </span>
    );
  }

  if (estado === 'salvo') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-jjs-verde">
        <Check size={16} />
        Salvo
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-jjs-texto-fraco">
      <Loader2 size={16} className="animate-spin" />
      Salvando...
    </span>
  );
}
