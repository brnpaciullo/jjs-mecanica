import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@jjs/ui';

type Tom = 'erro' | 'ok' | 'info';

const TONS: Record<Tom, { caixa: string; Icone: typeof Info }> = {
  erro: { caixa: 'border-jjs-vermelho bg-jjs-vermelho/10 text-jjs-preto', Icone: AlertTriangle },
  ok: { caixa: 'border-jjs-verde bg-jjs-verde/10 text-jjs-preto', Icone: CheckCircle2 },
  info: { caixa: 'border-jjs-amarelo-escuro bg-jjs-amarelo/15 text-jjs-preto', Icone: Info },
};

/** Mensagem que diz o que fazer, nunca só que deu errado. Cor + ícone + texto. */
export function Aviso({ tom = 'info', children }: { tom?: Tom; children: React.ReactNode }) {
  const { caixa, Icone } = TONS[tom];
  return (
    <div className={cn('flex items-start gap-2.5 rounded-card border px-4 py-3', caixa)}>
      <Icone size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
