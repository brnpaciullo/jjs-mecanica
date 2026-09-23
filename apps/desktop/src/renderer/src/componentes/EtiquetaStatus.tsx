import {
  CheckCircle2,
  ClipboardList,
  Flag,
  Hourglass,
  PackageCheck,
  Wrench,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { ROTULO_STATUS, type StatusOrdem } from '@jjs/core';
import { cn } from '@jjs/ui';

/**
 * Status sempre com cor + ícone + texto, nunca só cor: parte da equipe pode
 * não distinguir bem as cores, e a tela é lida de longe na bancada.
 */
const VISUAL: Record<StatusOrdem, { classe: string; Icone: LucideIcon }> = {
  recepcao: { classe: 'bg-jjs-grafite/10 text-jjs-preto border-jjs-borda', Icone: ClipboardList },
  diagnostico: {
    classe: 'bg-jjs-amarelo/20 text-jjs-preto border-jjs-amarelo-escuro',
    Icone: Wrench,
  },
  orcamento_enviado: {
    classe: 'bg-jjs-amarelo/20 text-jjs-preto border-jjs-amarelo-escuro',
    Icone: Hourglass,
  },
  aprovado: { classe: 'bg-jjs-verde/15 text-jjs-preto border-jjs-verde', Icone: CheckCircle2 },
  recusado: { classe: 'bg-jjs-vermelho/15 text-jjs-preto border-jjs-vermelho', Icone: XCircle },
  em_servico: {
    classe: 'bg-jjs-amarelo/25 text-jjs-preto border-jjs-amarelo-escuro',
    Icone: Wrench,
  },
  pronto: { classe: 'bg-jjs-verde/20 text-jjs-preto border-jjs-verde', Icone: PackageCheck },
  entregue: { classe: 'bg-jjs-grafite/10 text-jjs-texto-fraco border-jjs-borda', Icone: Flag },
};

export function EtiquetaStatus({ status, className }: { status: StatusOrdem; className?: string }) {
  const { classe, Icone } = VISUAL[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-campo border px-2.5 py-1 text-sm font-semibold',
        classe,
        className,
      )}
    >
      <Icone size={16} aria-hidden="true" />
      {ROTULO_STATUS[status]}
    </span>
  );
}
