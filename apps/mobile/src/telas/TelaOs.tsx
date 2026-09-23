import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import {
  ROTULO_MOMENTO,
  ROTULO_STATUS,
  STATUS_ORDEM,
  formatarDinheiro,
  formatarNumeroOs,
  formatarPlaca,
  lerDinheiro,
  type StatusOrdem,
} from '@jjs/core';
import { api, type OsCompleta } from '../api.js';
import { Cabecalho } from '../componentes/Cabecalho.js';
import { CameraDoMecanico } from '../componentes/Camera.js';
import { FilaDeEnvio } from '../componentes/FilaDeEnvio.js';

export function TelaOs() {
  const { id } = useParams();
  const ordemId = Number(id);
  const [dados, setDados] = useState<OsCompleta | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setDados(await api.os(ordemId));
      setErro(null);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não consegui carregar a OS.');
    }
  }, [ordemId]);

  useEffect(() => {
    // `Promise.resolve().then` e nao a chamada direta: o React 19 reclama de
    // setState sincrono dentro de efeito (renderizacao em cascata), e a funcao
    // marca "carregando" logo na primeira linha.
    void Promise.resolve().then(carregar);
  }, [carregar]);

  if (erro) {
    return (
      <div className="min-h-screen bg-jjs-papel">
        <Cabecalho titulo="OS" voltarPara="/" />
        <p className="m-4 rounded-card bg-jjs-vermelho/15 p-4">{erro}</p>
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="min-h-screen bg-jjs-papel">
        <Cabecalho titulo="OS" voltarPara="/" />
        <p className="p-4 text-jjs-texto-fraco">Carregando...</p>
      </div>
    );
  }

  const { ordem, detalhe, itens, totais, midias } = dados;

  return (
    <div className="min-h-screen bg-jjs-papel pb-8">
      <Cabecalho titulo={formatarNumeroOs(ordem.numero)} voltarPara="/" />

      <div className="flex flex-col gap-3 p-3">
        {/* Identificação */}
        <section className="rounded-card border border-jjs-borda bg-jjs-branco p-4">
          <div className="flex items-center gap-3">
            <span className="rounded-[4px] border-2 border-jjs-preto bg-white px-2 py-0.5 font-titulo text-2xl font-bold tracking-wider">
              {detalhe ? formatarPlaca(detalhe.placa) : ''}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {detalhe?.marca} {detalhe?.modelo}
              </p>
              <p className="truncate text-jjs-texto-fraco">{detalhe?.clienteNome}</p>
            </div>
          </div>

          <label className="mt-3 block text-sm font-semibold text-jjs-texto-fraco">Situação</label>
          <select
            value={ordem.status}
            onChange={async (e) => {
              await api.mudarStatus(ordemId, e.target.value);
              void carregar();
            }}
            className="mt-1 min-h-14 w-full rounded-campo border border-jjs-borda bg-jjs-branco px-3 text-lg"
          >
            {STATUS_ORDEM.map((s) => (
              <option key={s} value={s}>
                {ROTULO_STATUS[s as StatusOrdem]}
              </option>
            ))}
          </select>
        </section>

        <Queixas ordemId={ordemId} queixas={ordem.queixas} diagnostico={ordem.diagnostico} />

        <Itens ordemId={ordemId} itens={itens} totais={totais} aoMudar={carregar} />

        <CameraDoMecanico ordemId={ordemId} />
        <FilaDeEnvio aoTerminar={carregar} />

        <Galeria midias={midias} />
      </div>
    </div>
  );
}

/** Queixas é só leitura; o diagnóstico é o que o mecânico escreve. */
function Queixas({
  ordemId,
  queixas,
  diagnostico,
}: {
  ordemId: number;
  queixas: string;
  diagnostico: string | null;
}) {
  const [texto, setTexto] = useState(diagnostico ?? '');
  const [salvo, setSalvo] = useState(false);

  return (
    <>
      <section className="rounded-card border border-jjs-borda bg-jjs-branco p-4">
        <h2 className="font-titulo text-xl">O que o cliente falou</h2>
        <p className="mt-1 whitespace-pre-wrap">{queixas}</p>
      </section>

      <section className="rounded-card border border-jjs-borda bg-jjs-branco p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-titulo text-xl">O que você constatou</h2>
          {salvo ? <span className="text-sm text-jjs-verde">Salvo</span> : null}
        </div>
        <textarea
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setSalvo(false);
          }}
          onBlur={async () => {
            if (texto === (diagnostico ?? '')) return;
            await api.atualizarOs(ordemId, { diagnostico: texto });
            setSalvo(true);
          }}
          rows={4}
          placeholder="Escreva o que encontrou. É isso que vira o orçamento."
          className="mt-2 w-full rounded-campo border border-jjs-borda p-3"
        />
      </section>
    </>
  );
}

function Itens({
  ordemId,
  itens,
  totais,
  aoMudar,
}: {
  ordemId: number;
  itens: OsCompleta['itens'];
  totais: OsCompleta['totais'];
  aoMudar: () => void;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <section className="rounded-card border border-jjs-borda bg-jjs-branco p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-titulo text-xl">Itens</h2>
        <span className="font-titulo text-xl">{formatarDinheiro(totais.totalCentavos)}</span>
      </div>

      <ul className="mt-2 divide-y divide-jjs-borda">
        {itens.map((i) => (
          <li key={i.id} className="flex items-center gap-2 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate">{i.descricao}</span>
              <span className="block text-sm text-jjs-texto-fraco">
                {i.quantidade} × {formatarDinheiro(i.valorUnitarioCentavos)}
                {i.tipo === 'peca' ? ' · peça' : ' · mão de obra'}
              </span>
            </span>
            <button
              type="button"
              aria-label={`Remover ${i.descricao}`}
              onClick={async () => {
                await api.removerItem(i.id);
                aoMudar();
              }}
              className="flex size-11 items-center justify-center rounded-campo text-jjs-vermelho active:bg-jjs-papel"
            >
              <Trash2 size={20} />
            </button>
          </li>
        ))}
      </ul>

      {itens.length === 0 ? (
        <p className="py-2 text-jjs-texto-fraco">Nenhum item lançado ainda.</p>
      ) : null}

      {aberto ? (
        <NovoItem
          ordemId={ordemId}
          aoSalvar={() => {
            setAberto(false);
            aoMudar();
          }}
          aoCancelar={() => setAberto(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="mt-2 flex min-h-14 w-full items-center justify-center gap-2 rounded-campo border border-jjs-borda font-semibold active:bg-jjs-papel"
        >
          <Plus size={22} />
          Lançar item
        </button>
      )}
    </section>
  );
}

/** O mecânico também lança preço — é uma decisão da oficina, não um descuido. */
function NovoItem({
  ordemId,
  aoSalvar,
  aoCancelar,
}: {
  ordemId: number;
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [tipo, setTipo] = useState<'peca' | 'mao_de_obra'>('mao_de_obra');
  const [sugestoes, setSugestoes] = useState<
    {
      id: number;
      descricao: string;
      tipo: 'peca' | 'mao_de_obra';
      valorPadraoCentavos: number | null;
    }[]
  >([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (descricao.trim().length < 2) return;
    let valendo = true;
    const t = setTimeout(() => {
      void api.catalogo(descricao).then((s) => valendo && setSugestoes(s));
    }, 250);
    return () => {
      valendo = false;
      clearTimeout(t);
    };
  }, [descricao]);

  async function salvar() {
    if (!descricao.trim()) return;
    setSalvando(true);
    try {
      await api.adicionarItem(ordemId, {
        tipo,
        descricao: descricao.trim(),
        quantidade: 1,
        valorUnitarioCentavos: lerDinheiro(valor) ?? 0,
      });
      aoSalvar();
    } finally {
      setSalvando(false);
    }
  }

  const visiveis = descricao.trim().length >= 2 ? sugestoes : [];

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-card border border-jjs-borda p-3">
      <input
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        placeholder="O que foi feito ou trocado"
        autoFocus
        className="min-h-14 rounded-campo border border-jjs-borda px-3"
      />

      {visiveis.length > 0 ? (
        <ul className="max-h-48 overflow-y-auto rounded-campo border border-jjs-borda">
          {visiveis.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  setDescricao(s.descricao);
                  setTipo(s.tipo);
                  if (s.valorPadraoCentavos)
                    setValor((s.valorPadraoCentavos / 100).toFixed(2).replace('.', ','));
                  setSugestoes([]);
                }}
                className="flex min-h-12 w-full items-center justify-between gap-2 px-3 text-left active:bg-jjs-papel"
              >
                <span className="truncate">{s.descricao}</span>
                <span className="shrink-0 text-sm text-jjs-texto-fraco">
                  {s.valorPadraoCentavos === null
                    ? 'a combinar'
                    : formatarDinheiro(s.valorPadraoCentavos)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex gap-2">
        {(['mao_de_obra', 'peca'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTipo(t)}
            className={
              'min-h-12 flex-1 rounded-campo border font-semibold ' +
              (tipo === t ? 'border-jjs-amarelo-escuro bg-jjs-amarelo' : 'border-jjs-borda')
            }
          >
            {t === 'peca' ? 'Peça' : 'Mão de obra'}
          </button>
        ))}
      </div>

      <input
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        inputMode="decimal"
        placeholder="Valor (R$)"
        className="min-h-14 rounded-campo border border-jjs-borda px-3 text-right"
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={aoCancelar}
          className="min-h-14 flex-1 rounded-campo border border-jjs-borda font-semibold"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void salvar()}
          disabled={salvando || !descricao.trim()}
          className="min-h-14 flex-1 rounded-campo bg-jjs-amarelo font-semibold text-jjs-preto disabled:opacity-50"
        >
          {salvando ? 'Salvando...' : 'Lançar'}
        </button>
      </div>
    </div>
  );
}

function Galeria({ midias }: { midias: OsCompleta['midias'] }) {
  if (midias.length === 0) return null;

  return (
    <section className="rounded-card border border-jjs-borda bg-jjs-branco p-4">
      <h2 className="font-titulo text-xl">Fotos e vídeos ({midias.length})</h2>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {midias.map((m) => (
          <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="block">
            {m.statusProcessamento === 'pendente' ? (
              <span className="flex aspect-square items-center justify-center rounded-campo bg-jjs-papel p-1 text-center text-xs text-jjs-texto-fraco">
                Processando vídeo...
              </span>
            ) : (
              <img
                src={m.thumbUrl ?? m.url}
                alt={m.legenda ?? ROTULO_MOMENTO[m.momento]}
                loading="lazy"
                className="aspect-square w-full rounded-campo border border-jjs-borda object-cover"
              />
            )}
            <span className="mt-0.5 block text-center text-xs text-jjs-texto-fraco">
              {ROTULO_MOMENTO[m.momento]}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
