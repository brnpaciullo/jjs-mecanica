import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import {
  ROTULO_STATUS,
  STATUS_ORDEM,
  formatarData,
  formatarNumeroOs,
  lerData,
  type StatusOrdem,
} from '@jjs/core';
import type { OrdemNaLista } from '@jjs/db';
import { EstadoVazio, Placa } from '@jjs/ui';
import { Pagina } from '../componentes/Pagina.js';
import { Aviso } from '../componentes/Aviso.js';
import { EtiquetaStatus } from '../componentes/EtiquetaStatus.js';
import { useConsulta } from '../hooks/useConsulta.js';

export function HistoricoDeOs() {
  const [status, setStatus] = useState<StatusOrdem | ''>('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');

  const { dados, carregando, erro } = useConsulta<OrdemNaLista[]>(
    () =>
      window.jjs.ordens.historico({
        status: status || null,
        de: de ? lerData(formatarDataDoInput(de)) : null,
        // Até o fim do dia escolhido, senão a própria data filtrada fica de fora.
        ate: ate ? fimDoDia(ate) : null,
      }),
    [status, de, ate],
  );

  const ordens = dados ?? [];

  return (
    <Pagina titulo="Histórico de OS">
      <div className="flex flex-wrap items-end gap-4 rounded-card border border-jjs-borda bg-jjs-branco p-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="f-status" className="text-sm font-semibold">
            Situação
          </label>
          <select
            id="f-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusOrdem | '')}
            className="min-h-toque rounded-campo border border-jjs-borda bg-jjs-branco px-3"
          >
            <option value="">Todas</option>
            {STATUS_ORDEM.map((s) => (
              <option key={s} value={s}>
                {ROTULO_STATUS[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="f-de" className="text-sm font-semibold">
            De
          </label>
          <input
            id="f-de"
            type="date"
            value={de}
            onChange={(e) => setDe(e.target.value)}
            className="min-h-toque rounded-campo border border-jjs-borda px-3"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="f-ate" className="text-sm font-semibold">
            Até
          </label>
          <input
            id="f-ate"
            type="date"
            value={ate}
            onChange={(e) => setAte(e.target.value)}
            className="min-h-toque rounded-campo border border-jjs-borda px-3"
          />
        </div>

        {status || de || ate ? (
          <button
            type="button"
            onClick={() => {
              setStatus('');
              setDe('');
              setAte('');
            }}
            className="min-h-toque px-3 text-jjs-texto-fraco underline-offset-2 hover:underline"
          >
            Limpar filtros
          </button>
        ) : null}

        <span className="ml-auto text-jjs-texto-fraco">
          {carregando ? 'Carregando...' : `${ordens.length} OS`}
        </span>
      </div>

      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      {!carregando && ordens.length === 0 ? (
        <EstadoVazio
          icone={<ClipboardList size={44} />}
          titulo={status || de || ate ? 'Nenhuma OS nesse filtro' : 'Nenhuma OS por aqui ainda'}
          descricao={
            status || de || ate
              ? 'Tente afrouxar o filtro ou limpar tudo.'
              : 'Toda OS fica guardada aqui, com o que foi feito em cada carro.'
          }
        />
      ) : null}

      {ordens.length > 0 ? (
        <ul className="divide-y divide-jjs-borda overflow-hidden rounded-card border border-jjs-borda bg-jjs-branco">
          {ordens.map((ordem) => (
            <li key={ordem.id}>
              <Link
                to={`/os/${ordem.id}`}
                className="flex min-h-toque flex-wrap items-center gap-3 px-4 py-3 hover:bg-jjs-papel"
              >
                <span className="w-24 font-titulo text-lg font-bold">
                  {formatarNumeroOs(ordem.numero)}
                </span>
                <Placa placa={ordem.placa} tamanho="pequena" />
                <span className="w-44 truncate">
                  {ordem.marca} {ordem.modelo}
                </span>
                <span className="w-40 truncate text-jjs-texto-fraco">{ordem.clienteNome}</span>
                <span className="flex-1 truncate text-jjs-texto-fraco">{ordem.queixas}</span>
                <span className="tabular-nums text-sm text-jjs-texto-fraco">
                  {formatarData(ordem.criadoEm)}
                </span>
                <EtiquetaStatus status={ordem.status} />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </Pagina>
  );
}

/** O input date devolve aaaa-mm-dd; lerData espera dd/mm/aaaa. */
function formatarDataDoInput(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** Fim do dia escolhido, no fuso local, para o filtro "até" incluir o próprio dia. */
function fimDoDia(iso: string): string {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano!, (mes ?? 1) - 1, dia, 23, 59, 59, 999).toISOString();
}
