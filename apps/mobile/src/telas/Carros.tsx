import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, Car, Image, Plus, RefreshCw } from 'lucide-react';
import {
  COLUNAS_QUADRO,
  ROTULO_STATUS,
  formatarDiasNaOficina,
  formatarNumeroOs,
  formatarPlaca,
  type StatusOrdem,
} from '@jjs/core';
import { api, type OrdemNoQuadro } from '../api.js';
import { Cabecalho } from '../componentes/Cabecalho.js';

/**
 * Lista de cards grandes, com abas por situação.
 *
 * Não é o quadro de colunas do balcão de propósito: arrastar card lado a lado
 * não funciona numa tela de celular segurada com uma mão só.
 */
export function Carros({ nome }: { nome: string | null }) {
  const navegar = useNavigate();
  const [ordens, setOrdens] = useState<OrdemNoQuadro[]>([]);
  const [aba, setAba] = useState<StatusOrdem | 'todas'>('todas');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    try {
      setOrdens(await api.quadro());
      setErro(null);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não consegui carregar.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    // `Promise.resolve().then` e nao a chamada direta: o React 19 reclama de
    // setState sincrono dentro de efeito (renderizacao em cascata), e a funcao
    // marca "carregando" logo na primeira linha.
    void Promise.resolve().then(carregar);
  }, []);

  const visiveis = aba === 'todas' ? ordens : ordens.filter((o) => o.status === aba);
  const contar = (s: StatusOrdem) => ordens.filter((o) => o.status === s).length;

  return (
    <div className="min-h-screen bg-jjs-papel pb-28">
      <Cabecalho
        titulo="Carros na oficina"
        acao={
          <button
            type="button"
            onClick={() => void carregar()}
            aria-label="Atualizar"
            className="flex size-12 items-center justify-center rounded-campo active:bg-jjs-grafite"
          >
            <RefreshCw size={22} className={carregando ? 'animate-spin' : ''} />
          </button>
        }
      />

      {/* Abas roláveis: cabem todas as situações sem espremer. */}
      <div className="sticky top-16 z-10 flex gap-2 overflow-x-auto bg-jjs-preto px-3 pb-3">
        <Aba ativa={aba === 'todas'} onClick={() => setAba('todas')}>
          Todos ({ordens.length})
        </Aba>
        {COLUNAS_QUADRO.map((s) => (
          <Aba key={s} ativa={aba === s} onClick={() => setAba(s)}>
            {ROTULO_STATUS[s]} ({contar(s)})
          </Aba>
        ))}
      </div>

      {erro ? (
        <p className="m-4 rounded-card bg-jjs-vermelho/15 p-4 text-jjs-preto">{erro}</p>
      ) : null}

      {!carregando && visiveis.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <Car size={48} className="text-jjs-texto-fraco" aria-hidden="true" />
          <p className="font-titulo text-2xl">
            {aba === 'todas' ? 'Nenhum carro na oficina' : 'Nada nesta situação'}
          </p>
          <p className="text-jjs-texto-fraco">
            Quando chegar um carro, abra o atendimento aqui embaixo.
          </p>
        </div>
      ) : null}

      <ul className="flex flex-col gap-3 p-3">
        {visiveis.map((o) => (
          <li key={o.id}>
            <Link
              to={`/os/${o.id}`}
              className="block rounded-card border border-jjs-borda bg-jjs-branco p-4 active:border-jjs-amarelo-escuro"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-[4px] border-2 border-jjs-preto bg-white px-2 py-0.5 font-titulo text-xl font-bold tracking-wider">
                  {formatarPlaca(o.placa)}
                </span>
                <span className="rounded-campo bg-jjs-papel px-2 py-1 text-sm">
                  {ROTULO_STATUS[o.status as StatusOrdem]}
                </span>
              </div>

              <p className="mt-2 text-lg font-semibold">
                {o.marca} {o.modelo}
              </p>
              <p className="text-jjs-texto-fraco">{o.clienteNome}</p>
              <p className="mt-1 line-clamp-2 text-jjs-texto-fraco">{o.queixas}</p>

              <div className="mt-2 flex items-center justify-between text-sm text-jjs-texto-fraco">
                <span>{formatarNumeroOs(o.numero)}</span>
                <span className="flex items-center gap-3">
                  {o.totalMidias > 0 ? (
                    <span className="flex items-center gap-1">
                      <Image size={16} aria-hidden="true" />
                      {o.totalMidias}
                    </span>
                  ) : null}
                  {formatarDiasNaOficina(o.criadoEm)}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Botão fixo: abrir atendimento é o que mais se faz com o carro na porta. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-jjs-borda bg-jjs-branco p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => navegar('/novo')}
          className="flex min-h-16 w-full items-center justify-center gap-3 rounded-card bg-jjs-amarelo font-titulo text-xl font-bold text-jjs-preto active:bg-jjs-amarelo-escuro"
        >
          <Plus size={26} />
          Abrir atendimento
        </button>
        {nome ? <p className="mt-1 text-center text-xs text-jjs-texto-fraco">{nome}</p> : null}
      </div>

      <span className="hidden">
        <Camera />
      </span>
    </div>
  );
}

function Aba({
  ativa,
  onClick,
  children,
}: {
  ativa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'min-h-11 whitespace-nowrap rounded-campo px-4 font-semibold ' +
        (ativa ? 'bg-jjs-amarelo text-jjs-preto' : 'bg-jjs-grafite text-white/80')
      }
    >
      {children}
    </button>
  );
}
