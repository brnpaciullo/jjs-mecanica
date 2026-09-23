import { useState } from 'react';
import { Inbox, Link2, Play, Search } from 'lucide-react';
import { ROTULO_MOMENTO, formatarDataHora, formatarNumeroOs } from '@jjs/core';
import type { OrdemNaLista } from '@jjs/db';
import type { MidiaNaTela } from '../../../main/midias/consultar.js';
import { Botao, EstadoVazio, Placa } from '@jjs/ui';
import { Pagina } from '../componentes/Pagina.js';
import { Dialogo } from '../componentes/Dialogo.js';
import { Aviso } from '../componentes/Aviso.js';
import { useConsulta } from '../hooks/useConsulta.js';
import { mensagemDeErro } from '../erro.js';
import { urlDaMidia } from '../midia.js';

/**
 * Caixa de entrada das mídias que chegaram pelo WhatsApp sem OS identificada.
 *
 * Sem esta tela, foto mandada sem legenda sumiria — e o mecânico continuaria
 * achando que registrou o serviço.
 */
export function MidiasSemOs() {
  const { dados, erro, recarregar } = useConsulta<MidiaNaTela[]>(
    () => window.jjs.midias.semOs(),
    [],
  );
  const [anexando, setAnexando] = useState<MidiaNaTela | null>(null);
  const [recado, setRecado] = useState<string | null>(null);

  const midias = dados ?? [];

  return (
    <Pagina titulo="Mídias sem OS">
      <p className="text-jjs-texto-fraco">
        O que chegou pelo WhatsApp e não deu para identificar. Anexe cada uma à OS certa — ou o
        registro do serviço fica perdido aqui.
      </p>

      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {recado ? <Aviso tom="ok">{recado}</Aviso> : null}

      {midias.length === 0 ? (
        <EstadoVazio
          icone={<Inbox size={44} />}
          titulo="Nada esperando aqui"
          descricao="Quando o mecânico mandar uma foto no WhatsApp com a legenda certa, ela vai direto para a OS. Só o que não for reconhecido cai nesta caixa."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {midias.map((m) => (
            <li
              key={m.id}
              className="flex flex-col gap-2 rounded-card border border-jjs-borda bg-jjs-branco p-3"
            >
              <div className="relative aspect-video overflow-hidden rounded-campo bg-jjs-papel">
                {m.statusProcessamento === 'pendente' ? (
                  <span className="flex size-full items-center justify-center text-jjs-texto-fraco">
                    Processando vídeo...
                  </span>
                ) : (
                  <>
                    <img
                      src={urlDaMidia(m.thumbUrl ?? m.url)}
                      alt={m.legenda ?? 'Mídia recebida'}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                    {m.tipo === 'video' ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                        <Play size={32} fill="currentColor" />
                      </span>
                    ) : null}
                  </>
                )}
              </div>

              <p className="text-sm text-jjs-texto-fraco">
                {formatarDataHora(m.criadoEm)} · {ROTULO_MOMENTO[m.momento]}
              </p>
              {m.legenda ? (
                <p className="text-sm">
                  Legenda: <span className="text-jjs-texto-fraco">&quot;{m.legenda}&quot;</span>
                </p>
              ) : (
                <p className="text-sm text-jjs-texto-fraco">Chegou sem legenda.</p>
              )}

              <Botao
                variante="principal"
                icone={<Link2 size={18} />}
                onClick={() => setAnexando(m)}
              >
                Anexar a uma OS
              </Botao>
            </li>
          ))}
        </ul>
      )}

      <Dialogo
        titulo="Anexar a qual OS?"
        aberto={anexando !== null}
        aoFechar={() => setAnexando(null)}
        largura="larga"
      >
        {anexando ? (
          <EscolherOs
            sugestao={anexando.legenda ?? ''}
            aoEscolher={async (ordem) => {
              try {
                await window.jjs.midias.anexar(anexando.id, ordem.id);
                setRecado(`Mídia anexada à ${formatarNumeroOs(ordem.numero)}.`);
                setAnexando(null);
                recarregar();
              } catch (causa) {
                setRecado(null);
                setAnexando(null);
                alert(mensagemDeErro(causa));
              }
            }}
          />
        ) : null}
      </Dialogo>
    </Pagina>
  );
}

/** Busca por placa ou número, que é como a oficina identifica um atendimento. */
function EscolherOs({
  sugestao,
  aoEscolher,
}: {
  sugestao: string;
  aoEscolher: (ordem: OrdemNaLista) => void;
}) {
  // Começa com a legenda que não foi reconhecida: às vezes falta só um ajuste.
  const [termo, setTermo] = useState(sugestao);

  const { dados } = useConsulta<OrdemNaLista[]>(() => window.jjs.ordens.quadro(), []);
  const ordens = dados ?? [];

  const busca = termo.trim().toLowerCase();
  const visiveis = busca
    ? ordens.filter(
        (o) =>
          o.placa.toLowerCase().includes(busca.replace(/[^a-z0-9]/gi, '')) ||
          String(o.numero).includes(busca.replace(/\D/g, '')) ||
          o.clienteNome.toLowerCase().includes(busca) ||
          `${o.marca} ${o.modelo}`.toLowerCase().includes(busca),
      )
    : ordens;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search
          size={20}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-jjs-texto-fraco"
        />
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Placa, número da OS ou nome do cliente"
          autoFocus
          className="min-h-toque w-full rounded-campo border border-jjs-borda pl-11 pr-3"
        />
      </div>

      {visiveis.length === 0 ? (
        <p className="text-jjs-texto-fraco">
          Nenhum carro na oficina com isso. Só aparecem aqui as OS abertas.
        </p>
      ) : (
        <ul className="max-h-96 divide-y divide-jjs-borda overflow-y-auto rounded-card border border-jjs-borda">
          {visiveis.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => aoEscolher(o)}
                className="flex min-h-toque w-full items-center gap-3 px-4 py-3 text-left hover:bg-jjs-papel"
              >
                <Placa placa={o.placa} tamanho="pequena" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {o.marca} {o.modelo}
                  </span>
                  <span className="block truncate text-sm text-jjs-texto-fraco">
                    {o.clienteNome}
                  </span>
                </span>
                <span className="font-titulo text-lg">{formatarNumeroOs(o.numero)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
