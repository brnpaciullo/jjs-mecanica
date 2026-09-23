import { useEffect, useState } from 'react';
import { AlertTriangle, Check, RotateCw, X } from 'lucide-react';
import { filaDeUpload, type ItemDaFila } from '../fila-upload.js';

/**
 * Mostra o que está subindo.
 *
 * O mecânico precisa ver que a foto saiu do celular — senão ele fica na dúvida
 * e tira de novo. Falha fica visível com botão de tentar outra vez; sucesso
 * some sozinho depois de um tempo.
 */
export function FilaDeEnvio({ aoTerminar }: { aoTerminar: () => void }) {
  const [itens, setItens] = useState<ItemDaFila[]>([]);

  useEffect(() => filaDeUpload.observar(setItens), []);

  useEffect(() => {
    const enviados = itens.filter((i) => i.situacao === 'enviado');
    if (enviados.length === 0) return;

    aoTerminar();
    const t = setTimeout(() => filaDeUpload.limparEnviados(), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens.filter((i) => i.situacao === 'enviado').length]);

  if (itens.length === 0) return null;

  return (
    <ul className="flex flex-col gap-2">
      {itens.map((i) => (
        <li key={i.id} className="rounded-card border border-jjs-borda bg-jjs-branco p-3">
          <div className="flex items-center gap-3">
            {i.situacao === 'enviado' ? (
              <Check size={22} className="shrink-0 text-jjs-verde" />
            ) : i.situacao === 'erro' ? (
              <AlertTriangle size={22} className="shrink-0 text-jjs-vermelho" />
            ) : null}

            <span className="min-w-0 flex-1 truncate">
              {i.tipo === 'foto' ? 'Foto' : 'Vídeo'}
              {i.situacao === 'enviado' ? ' enviada' : ''}
            </span>

            {i.situacao === 'erro' ? (
              <>
                <button
                  type="button"
                  onClick={() => filaDeUpload.tentarDeNovo(i.id)}
                  aria-label="Tentar de novo"
                  className="flex size-11 items-center justify-center rounded-campo bg-jjs-amarelo text-jjs-preto"
                >
                  <RotateCw size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => filaDeUpload.descartar(i.id)}
                  aria-label="Descartar"
                  className="flex size-11 items-center justify-center rounded-campo border border-jjs-borda"
                >
                  <X size={20} />
                </button>
              </>
            ) : null}
          </div>

          {i.situacao === 'enviando' ? (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-jjs-papel">
              <div
                className="h-full bg-jjs-amarelo transition-[width]"
                style={{ width: `${i.progresso}%` }}
              />
            </div>
          ) : null}

          {i.erro ? <p className="mt-1 text-sm text-jjs-vermelho">{i.erro}</p> : null}
        </li>
      ))}
    </ul>
  );
}
