import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Car, Image, Plus } from 'lucide-react';
import {
  COLUNAS_QUADRO,
  ROTULO_STATUS,
  ehVoltarStatus,
  formatarDiasNaOficina,
  formatarNumeroOs,
  type StatusOrdem,
} from '@jjs/core';
import type { OrdemNaLista } from '@jjs/db';
import { Botao, EstadoVazio, Placa, cn } from '@jjs/ui';
import { Pagina } from '../componentes/Pagina.js';
import { Aviso } from '../componentes/Aviso.js';
import { Confirmacao } from '../componentes/Confirmacao.js';
import { useConsulta } from '../hooks/useConsulta.js';
import { mensagemDeErro } from '../erro.js';

/**
 * Tela inicial: um quadro em colunas por situação. Arrastar o card muda o
 * status — é o gesto que o balcão faz o dia inteiro.
 */
export function CarrosNaOficina() {
  const navegar = useNavigate();
  const [arrastando, setArrastando] = useState<OrdemNaLista | null>(null);
  const [colunaAlvo, setColunaAlvo] = useState<StatusOrdem | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmarVolta, setConfirmarVolta] = useState<{
    ordem: OrdemNaLista;
    destino: StatusOrdem;
  } | null>(null);

  const {
    dados,
    carregando,
    erro: erroConsulta,
    recarregar,
  } = useConsulta<OrdemNaLista[]>(() => window.jjs.ordens.quadro(), []);

  const ordens = dados ?? [];

  async function mover(ordem: OrdemNaLista, destino: StatusOrdem) {
    try {
      await window.jjs.ordens.mudarStatus({ id: ordem.id, status: destino });
      setErro(null);
      recarregar();
    } catch (causa) {
      setErro(mensagemDeErro(causa));
    }
  }

  function soltarNaColuna(destino: StatusOrdem) {
    const ordem = arrastando;
    setArrastando(null);
    setColunaAlvo(null);
    if (!ordem || ordem.status === destino) return;

    // Voltar no fluxo pede confirmação: arrastar errado é fácil.
    if (ehVoltarStatus(ordem.status, destino)) setConfirmarVolta({ ordem, destino });
    else void mover(ordem, destino);
  }

  return (
    <Pagina
      titulo="Carros na oficina"
      acoes={
        <Botao
          variante="principal"
          tamanho="grande"
          icone={<Plus size={22} />}
          onClick={() => navegar('/atendimento/novo')}
        >
          Abrir atendimento
        </Botao>
      }
    >
      {erroConsulta ? <Aviso tom="erro">{erroConsulta}</Aviso> : null}
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      {!carregando && ordens.length === 0 ? (
        <EstadoVazio
          icone={<Car size={44} />}
          titulo="Nenhum carro na oficina"
          descricao="Quando chegar um carro, abra o atendimento com a placa e o que o cliente relatou."
          acao={
            <Botao
              variante="principal"
              tamanho="grande"
              icone={<Plus size={22} />}
              onClick={() => navegar('/atendimento/novo')}
            >
              Abrir atendimento
            </Botao>
          }
        />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUNAS_QUADRO.map((status) => {
            const daColuna = ordens.filter((o) => o.status === status);
            return (
              <section
                key={status}
                onDragOver={(e) => {
                  e.preventDefault();
                  setColunaAlvo(status);
                }}
                onDragLeave={() => setColunaAlvo((c) => (c === status ? null : c))}
                onDrop={() => soltarNaColuna(status)}
                className={cn(
                  'flex w-72 shrink-0 flex-col rounded-card border-2 p-2 transition-colors',
                  colunaAlvo === status
                    ? 'border-jjs-amarelo-escuro bg-jjs-amarelo/10'
                    : 'border-transparent bg-black/[0.03]',
                )}
              >
                <header className="flex items-center justify-between px-2 py-2">
                  <h2 className="font-titulo text-lg text-jjs-preto">{ROTULO_STATUS[status]}</h2>
                  <span className="rounded-full bg-jjs-preto px-2 py-0.5 text-sm font-semibold text-white tabular-nums">
                    {daColuna.length}
                  </span>
                </header>

                <ul className="flex flex-col gap-2">
                  {daColuna.map((ordem) => (
                    <li key={ordem.id}>
                      <Link
                        to={`/os/${ordem.id}`}
                        draggable
                        onDragStart={() => setArrastando(ordem)}
                        onDragEnd={() => {
                          setArrastando(null);
                          setColunaAlvo(null);
                        }}
                        className={cn(
                          'block cursor-grab rounded-card border border-jjs-borda bg-jjs-branco p-3',
                          'hover:border-jjs-amarelo-escuro',
                          arrastando?.id === ordem.id && 'opacity-40',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Placa placa={ordem.placa} tamanho="pequena" />
                          {ordem.totalMidias > 0 ? (
                            <span
                              className="flex items-center gap-1 text-sm text-jjs-texto-fraco"
                              title={`${ordem.totalMidias} foto(s) ou vídeo(s)`}
                            >
                              <Image size={16} aria-hidden="true" />
                              {ordem.totalMidias}
                            </span>
                          ) : null}
                        </div>

                        <p className="mt-2 truncate font-semibold text-jjs-preto">
                          {ordem.marca} {ordem.modelo}
                        </p>
                        <p className="truncate text-sm text-jjs-texto-fraco">{ordem.clienteNome}</p>

                        <div className="mt-2 flex items-center justify-between text-sm text-jjs-texto-fraco">
                          <span>{formatarNumeroOs(ordem.numero)}</span>
                          <span>{formatarDiasNaOficina(ordem.criadoEm)}</span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>

                {daColuna.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-jjs-texto-fraco">
                    Arraste um card para cá
                  </p>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      <Confirmacao
        aberto={confirmarVolta !== null}
        titulo="Voltar a situação da OS?"
        mensagem={
          confirmarVolta
            ? `A ${formatarNumeroOs(confirmarVolta.ordem.numero)} (${confirmarVolta.ordem.placa}) vai voltar de "${ROTULO_STATUS[confirmarVolta.ordem.status]}" para "${ROTULO_STATUS[confirmarVolta.destino]}". Fica registrado na linha do tempo, e os itens e valores não mudam.`
            : ''
        }
        rotuloConfirmar="Voltar mesmo assim"
        aoConfirmar={() => {
          const pedido = confirmarVolta;
          setConfirmarVolta(null);
          if (pedido) void mover(pedido.ordem, pedido.destino);
        }}
        aoCancelar={() => setConfirmarVolta(null)}
      />
    </Pagina>
  );
}
