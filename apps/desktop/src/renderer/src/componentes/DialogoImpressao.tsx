import { useState } from 'react';
import { FileText, Printer } from 'lucide-react';
import { Dialogo } from './Dialogo.js';
import { Aviso } from './Aviso.js';
import { mensagemDeErro } from '../erro.js';

export interface DialogoImpressaoProps {
  aberto: boolean;
  ordemId: number;
  titulo: string;
  aoFechar: () => void;
}

/**
 * Nem toda impressora aceita A5, e descobrir isso com o cliente esperando é
 * ruim. Por isso as duas saídas ficam lado a lado: A5, que é o padrão da casa,
 * e A4 com duas vias para cortar ao meio — mesmo documento, papel que todo
 * mundo tem.
 */
export function DialogoImpressao({ aberto, ordemId, titulo, aoFechar }: DialogoImpressaoProps) {
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function imprimir(duasViasEmA4: boolean) {
    setOcupado(true);
    setErro(null);
    try {
      const r = await window.jjs.pdf.imprimir({ id: ordemId, duasViasEmA4 });
      if (!r.impresso) {
        // "cancelled" é o usuário fechando a caixa do Windows — não é erro.
        if (r.motivo && r.motivo !== 'cancelled') {
          setErro(
            `A impressão não foi concluída (${r.motivo}). ` +
              'Confira se a impressora está ligada e com papel. ' +
              'Se ela não aceitar A5, use a opção de A4 com 2 vias.',
          );
          return;
        }
      }
      aoFechar();
    } catch (causa) {
      setErro(mensagemDeErro(causa));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Dialogo titulo={`Imprimir ${titulo.toLowerCase()}`} aberto={aberto} aoFechar={aoFechar}>
      <div className="flex flex-col gap-4">
        {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

        <button
          type="button"
          disabled={ocupado}
          onClick={() => void imprimir(false)}
          className="flex min-h-20 items-center gap-4 rounded-card border border-jjs-borda bg-jjs-branco px-5 text-left hover:border-jjs-amarelo-escuro disabled:opacity-50"
        >
          <Printer size={28} className="shrink-0" aria-hidden="true" />
          <span>
            <span className="block font-titulo text-xl">Papel A5</span>
            <span className="block text-jjs-texto-fraco">
              Meia folha. É o tamanho padrão do orçamento da oficina.
            </span>
          </span>
        </button>

        <button
          type="button"
          disabled={ocupado}
          onClick={() => void imprimir(true)}
          className="flex min-h-20 items-center gap-4 rounded-card border border-jjs-borda bg-jjs-branco px-5 text-left hover:border-jjs-amarelo-escuro disabled:opacity-50"
        >
          <FileText size={28} className="shrink-0" aria-hidden="true" />
          <span>
            <span className="block font-titulo text-xl">Papel A4 com 2 vias</span>
            <span className="block text-jjs-texto-fraco">
              Duas cópias lado a lado numa folha deitada, para cortar ao meio. Use quando a
              impressora não aceitar A5.
            </span>
          </span>
        </button>

        {ocupado ? <p className="text-jjs-texto-fraco">Preparando a impressão...</p> : null}
      </div>
    </Dialogo>
  );
}
