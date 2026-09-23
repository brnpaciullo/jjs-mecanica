import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Pencil, Wrench } from 'lucide-react';
import { formatarData, formatarNumeroOs } from '@jjs/core';
import type { OrdemNaLista, VeiculoComDono } from '@jjs/db';
import { Botao, EstadoVazio, Placa } from '@jjs/ui';
import { Pagina } from '../componentes/Pagina.js';
import { Dialogo } from '../componentes/Dialogo.js';
import { Aviso } from '../componentes/Aviso.js';
import { EtiquetaStatus } from '../componentes/EtiquetaStatus.js';
import { FormularioVeiculo } from '../componentes/FormularioVeiculo.js';
import { useConsulta } from '../hooks/useConsulta.js';

/** Tudo que já foi feito neste carro, em ordem — é o histórico da etapa 3. */
export function VeiculoHistorico() {
  const { id } = useParams();
  const veiculoId = Number(id);
  const [editando, setEditando] = useState(false);

  const veiculo = useConsulta<VeiculoComDono | null>(
    () => window.jjs.veiculos.buscar(veiculoId),
    [veiculoId],
  );
  const ordens = useConsulta<OrdemNaLista[]>(
    () => window.jjs.ordens.doVeiculo(veiculoId),
    [veiculoId],
  );

  if (veiculo.erro) {
    return (
      <Pagina titulo="Carro">
        <Aviso tom="erro">{veiculo.erro}</Aviso>
      </Pagina>
    );
  }

  if (!veiculo.dados) {
    return (
      <Pagina titulo="Carro">
        <p className="text-jjs-texto-fraco">
          {veiculo.carregando ? 'Carregando...' : 'Esse carro não foi encontrado.'}
        </p>
      </Pagina>
    );
  }

  const carro = veiculo.dados;
  const lista = ordens.dados ?? [];

  return (
    <Pagina
      titulo={`${carro.marca} ${carro.modelo}`}
      acoes={
        <Botao variante="secundario" icone={<Pencil size={18} />} onClick={() => setEditando(true)}>
          Editar carro
        </Botao>
      }
    >
      <section className="flex flex-wrap items-center gap-6 rounded-card border border-jjs-borda bg-jjs-branco p-5">
        <Placa placa={carro.placa} tamanho="grande" />
        <dl className="grid flex-1 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-sm text-jjs-texto-fraco">Dono</dt>
            <dd className="text-lg">
              <Link
                to={`/clientes/${carro.clienteId}`}
                className="underline-offset-2 hover:underline"
              >
                {carro.clienteNome}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-jjs-texto-fraco">Ano</dt>
            <dd className="text-lg">{carro.ano ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-sm text-jjs-texto-fraco">Cor</dt>
            <dd className="text-lg">{carro.cor || '—'}</dd>
          </div>
          <div>
            <dt className="text-sm text-jjs-texto-fraco">Km</dt>
            <dd className="text-lg tabular-nums">
              {carro.kmAtual ? carro.kmAtual.toLocaleString('pt-BR') : '—'}
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="mb-3 font-titulo text-2xl text-jjs-preto">
          Histórico deste carro {lista.length > 0 ? `(${lista.length})` : ''}
        </h2>

        {lista.length === 0 ? (
          <EstadoVazio
            icone={<Wrench size={40} />}
            titulo="Esse carro nunca passou pela oficina"
            descricao="Quando ele chegar, abra o atendimento pela tela de Carros na oficina."
          />
        ) : (
          <ol className="flex flex-col gap-3">
            {lista.map((ordem) => (
              <li key={ordem.id}>
                <Link
                  to={`/os/${ordem.id}`}
                  className="block rounded-card border border-jjs-borda bg-jjs-branco p-4 hover:border-jjs-amarelo-escuro"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-titulo text-xl font-bold">
                      {formatarNumeroOs(ordem.numero)}
                    </span>
                    <EtiquetaStatus status={ordem.status} />
                    <span className="ml-auto text-sm tabular-nums text-jjs-texto-fraco">
                      {formatarData(ordem.criadoEm)}
                    </span>
                  </div>
                  <p className="mt-2 text-jjs-texto-fraco">{ordem.queixas}</p>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <Dialogo titulo="Editar carro" aberto={editando} aoFechar={() => setEditando(false)}>
        <FormularioVeiculo
          clienteId={carro.clienteId}
          veiculo={carro}
          aoCancelar={() => setEditando(false)}
          aoSalvar={() => {
            setEditando(false);
            veiculo.recarregar();
          }}
        />
      </Dialogo>
    </Pagina>
  );
}
