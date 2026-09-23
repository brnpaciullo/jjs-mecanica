import { useState } from 'react';
import { Loader2, MessageCircle, Play, Send, X } from 'lucide-react';
import { MOMENTOS_MIDIA, ROTULO_MOMENTO, formatarDataHora, type MomentoMidia } from '@jjs/core';
import type { MidiaNaTela } from '../../../main/midias/consultar.js';
import { Botao, cn } from '@jjs/ui';
import { useConsulta } from '../hooks/useConsulta.js';
import { Aviso } from './Aviso.js';
import { urlDaMidia } from '../midia.js';
import { mensagemDeErro } from '../erro.js';

/**
 * Fotos e vídeos da OS, agrupados pelo momento em que foram feitos.
 *
 * O toggle "enviar ao cliente" é por mídia porque nem tudo serve para mostrar:
 * o mecânico fotografa muita coisa para registro interno, e o cliente deve ver
 * só o que explica o orçamento. O que está marcado vai dentro do PDF e também
 * solto no WhatsApp, junto do documento.
 *
 * O botão de mandar só as mídias fica aqui, e não na barra de ações da OS,
 * porque é aqui que a marcação acontece — e ele só aparece quando há algo
 * marcado, senão seria um botão que só sabe dar erro.
 */
export function GaleriaDeMidias({ ordemId }: { ordemId: number }) {
  const { dados, erro, recarregar } = useConsulta<MidiaNaTela[]>(
    () => window.jjs.midias.daOrdem(ordemId),
    [ordemId],
  );
  const [aberta, setAberta] = useState<MidiaNaTela | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  const midias = dados ?? [];
  if (erro) return <Aviso tom="erro">{erro}</Aviso>;
  if (midias.length === 0) return null;

  const marcadas = midias.filter((m) => m.incluirParaCliente).length;

  async function enviarSoAsMidias() {
    setEnviando(true);
    setRecado(null);
    setErroEnvio(null);
    try {
      const r = await window.jjs.whatsapp.enviarMidias(ordemId);
      setRecado(r.mensagem);
    } catch (causa) {
      setErroEnvio(mensagemDeErro(causa));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="rounded-card border border-jjs-borda bg-jjs-branco p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-titulo text-2xl text-jjs-preto">Fotos e vídeos ({midias.length})</h2>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-jjs-texto-fraco">
            {marcadas === 0
              ? 'Nenhuma marcada para o cliente'
              : `${marcadas} vai(ão) para o cliente`}
          </span>
          {marcadas > 0 ? (
            <Botao
              variante="secundario"
              icone={<MessageCircle size={18} />}
              disabled={enviando}
              onClick={() => void enviarSoAsMidias()}
              title="Manda só as mídias marcadas, sem repetir o PDF."
            >
              {enviando ? 'Enviando...' : 'Enviar só as mídias'}
            </Botao>
          ) : null}
        </div>
      </div>

      {erroEnvio ? (
        <div className="mt-3">
          <Aviso tom="erro">{erroEnvio}</Aviso>
        </div>
      ) : null}
      {recado ? (
        <div className="mt-3">
          <Aviso tom="ok">{recado}</Aviso>
        </div>
      ) : null}

      {MOMENTOS_MIDIA.map((momento) => {
        const doMomento = midias.filter((m) => m.momento === momento);
        if (doMomento.length === 0) return null;

        return (
          <div key={momento} className="mt-4">
            <h3 className="mb-2 font-titulo text-lg text-jjs-texto-fraco">
              {ROTULO_MOMENTO[momento as MomentoMidia]}
            </h3>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {doMomento.map((m) => (
                <li key={m.id} className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => m.statusProcessamento === 'pronto' && setAberta(m)}
                    className="relative aspect-square overflow-hidden rounded-campo border border-jjs-borda"
                  >
                    {m.statusProcessamento === 'pendente' ? (
                      <span className="flex size-full flex-col items-center justify-center gap-1 bg-jjs-papel p-2 text-center text-sm text-jjs-texto-fraco">
                        <Loader2 size={20} className="animate-spin" />
                        Processando vídeo...
                      </span>
                    ) : (
                      <>
                        {/*
                          Vídeo sem miniatura acontece quando o ffmpeg não veio
                          junto: aí não há quadro para mostrar. Um <img> apontado
                          para o .mp4 ficaria em branco para sempre, então o
                          lugar recebe o ícone de play e nada mais.
                        */}
                        {m.thumbUrl ? (
                          <img
                            src={urlDaMidia(m.thumbUrl)}
                            alt={m.legenda ?? ROTULO_MOMENTO[m.momento]}
                            loading="lazy"
                            className="size-full object-cover"
                          />
                        ) : m.tipo === 'foto' ? (
                          <img
                            src={urlDaMidia(m.url)}
                            alt={m.legenda ?? ROTULO_MOMENTO[m.momento]}
                            loading="lazy"
                            className="size-full object-cover"
                          />
                        ) : (
                          <span className="flex size-full items-center justify-center bg-jjs-papel" />
                        )}
                        {m.tipo === 'video' ? (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                            <Play size={32} fill="currentColor" />
                          </span>
                        ) : null}
                      </>
                    )}
                  </button>

                  <label
                    className={cn(
                      'relative flex min-h-10 cursor-pointer items-center justify-center gap-1.5',
                      'rounded-campo border px-2 text-sm font-semibold',
                      m.incluirParaCliente
                        ? 'border-jjs-verde bg-jjs-verde/15 text-jjs-preto'
                        : 'border-jjs-borda text-jjs-texto-fraco',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={m.incluirParaCliente}
                      onChange={async (e) => {
                        await window.jjs.midias.enviarAoCliente(m.id, e.target.checked);
                        recarregar();
                      }}
                      className="sr-only"
                    />
                    <Send size={14} />
                    {m.incluirParaCliente ? 'Vai ao cliente' : 'Só interno'}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {aberta ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onMouseDown={(e) => e.target === e.currentTarget && setAberta(null)}
        >
          <button
            type="button"
            onClick={() => setAberta(null)}
            aria-label="Fechar"
            className="absolute right-4 top-4 flex size-12 items-center justify-center rounded-campo bg-white/10 text-white"
          >
            <X size={26} />
          </button>

          {aberta.tipo === 'video' ? (
            <video
              src={urlDaMidia(aberta.url)}
              controls
              autoPlay
              className="max-h-full max-w-full rounded-card"
            />
          ) : (
            <img
              src={urlDaMidia(aberta.url)}
              alt={aberta.legenda ?? ''}
              className="max-h-full max-w-full rounded-card object-contain"
            />
          )}

          <p className="absolute inset-x-0 bottom-4 text-center text-white/80">
            {aberta.legenda ? `${aberta.legenda} · ` : ''}
            {ROTULO_MOMENTO[aberta.momento]} · {formatarDataHora(aberta.criadoEm)}
            {aberta.origem === 'whatsapp' ? ' · veio pelo WhatsApp' : ''}
          </p>
        </div>
      ) : null}
    </section>
  );
}
