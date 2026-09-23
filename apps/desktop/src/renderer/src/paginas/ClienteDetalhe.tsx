import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Car, Pencil, Plus } from 'lucide-react';
import { formatarNumeroOs, formatarTelefone, formatarData } from '@jjs/core';
import type { ClienteRegistro, OrdemNaLista, VeiculoRegistro } from '@jjs/db';
import { Botao, EstadoVazio, Placa } from '@jjs/ui';
import { Pagina } from '../componentes/Pagina.js';
import { Dialogo } from '../componentes/Dialogo.js';
import { Aviso } from '../componentes/Aviso.js';
import { EtiquetaStatus } from '../componentes/EtiquetaStatus.js';
import { FormularioCliente } from '../componentes/FormularioCliente.js';
import { FormularioVeiculo } from '../componentes/FormularioVeiculo.js';
import { useConsulta } from '../hooks/useConsulta.js';

export function ClienteDetalhe() {
  const { id } = useParams();
  const clienteId = Number(id);
  const [editando, setEditando] = useState(false);
  const [novoCarro, setNovoCarro] = useState(false);

  const cliente = useConsulta<ClienteRegistro | null>(
    () => window.jjs.clientes.buscar(clienteId),
    [clienteId],
  );
  const carros = useConsulta<VeiculoRegistro[]>(
    () => window.jjs.veiculos.doCliente(clienteId),
    [clienteId],
  );
  const ordens = useConsulta<OrdemNaLista[]>(
    () => window.jjs.ordens.doCliente(clienteId),
    [clienteId],
  );

  if (cliente.erro) {
    return (
      <Pagina titulo="Cliente">
        <Aviso tom="erro">{cliente.erro}</Aviso>
      </Pagina>
    );
  }

  if (!cliente.dados) {
    return (
      <Pagina titulo="Cliente">
        <p className="text-jjs-texto-fraco">
          {cliente.carregando ? 'Carregando...' : 'Esse cliente não foi encontrado.'}
        </p>
      </Pagina>
    );
  }

  const dono = cliente.dados;

  return (
    <Pagina
      titulo={dono.nome}
      acoes={
        <Botao variante="secundario" icone={<Pencil size={18} />} onClick={() => setEditando(true)}>
          Editar cadastro
        </Botao>
      }
    >
      <section className="rounded-card border border-jjs-borda bg-jjs-branco p-5">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-jjs-texto-fraco">Telefone</dt>
            <dd className="text-lg tabular-nums">{formatarTelefone(dono.telefone)}</dd>
          </div>
          <div>
            <dt className="text-sm text-jjs-texto-fraco">CPF</dt>
            <dd className="text-lg">{dono.cpf || '—'}</dd>
          </div>
          <div>
            <dt className="text-sm text-jjs-texto-fraco">Endereço</dt>
            <dd className="text-lg">{dono.endereco || '—'}</dd>
          </div>
        </dl>
        {dono.observacoes ? (
          <p className="mt-4 border-t border-jjs-borda pt-4 text-jjs-texto-fraco">
            {dono.observacoes}
          </p>
        ) : null}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-titulo text-2xl text-jjs-preto">Carros</h2>
          <Botao
            variante="secundario"
            icone={<Plus size={18} />}
            onClick={() => setNovoCarro(true)}
          >
            Adicionar carro
          </Botao>
        </div>

        {(carros.dados ?? []).length === 0 ? (
          <EstadoVazio
            icone={<Car size={40} />}
            titulo="Nenhum carro nesse cliente"
            descricao="Cadastre o carro para conseguir abrir um atendimento."
            acao={
              <Botao variante="principal" onClick={() => setNovoCarro(true)}>
                Cadastrar carro
              </Botao>
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {(carros.dados ?? []).map((carro) => (
              <li key={carro.id}>
                <Link
                  to={`/veiculos/${carro.id}`}
                  className="flex items-center gap-4 rounded-card border border-jjs-borda bg-jjs-branco p-4 hover:border-jjs-amarelo-escuro"
                >
                  <Placa placa={carro.placa} tamanho="pequena" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-jjs-preto">
                      {carro.marca} {carro.modelo}
                    </p>
                    <p className="text-sm text-jjs-texto-fraco">
                      {[carro.ano, carro.cor].filter(Boolean).join(' · ') || 'Sem detalhes'}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-titulo text-2xl text-jjs-preto">Atendimentos</h2>
        {(ordens.dados ?? []).length === 0 ? (
          <p className="rounded-card border border-dashed border-jjs-borda bg-jjs-branco px-4 py-8 text-center text-jjs-texto-fraco">
            Esse cliente ainda não teve nenhum atendimento.
          </p>
        ) : (
          <ul className="divide-y divide-jjs-borda overflow-hidden rounded-card border border-jjs-borda bg-jjs-branco">
            {(ordens.dados ?? []).map((ordem) => (
              <li key={ordem.id}>
                <Link
                  to={`/os/${ordem.id}`}
                  className="flex min-h-toque flex-wrap items-center gap-3 px-4 py-3 hover:bg-jjs-papel"
                >
                  <span className="font-titulo text-lg font-bold">
                    {formatarNumeroOs(ordem.numero)}
                  </span>
                  <Placa placa={ordem.placa} tamanho="pequena" />
                  <span className="flex-1 truncate text-jjs-texto-fraco">{ordem.queixas}</span>
                  <span className="text-sm tabular-nums text-jjs-texto-fraco">
                    {formatarData(ordem.criadoEm)}
                  </span>
                  <EtiquetaStatus status={ordem.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialogo titulo="Editar cliente" aberto={editando} aoFechar={() => setEditando(false)}>
        <FormularioCliente
          cliente={dono}
          aoCancelar={() => setEditando(false)}
          aoSalvar={() => {
            setEditando(false);
            cliente.recarregar();
          }}
        />
      </Dialogo>

      <Dialogo titulo="Novo carro" aberto={novoCarro} aoFechar={() => setNovoCarro(false)}>
        <FormularioVeiculo
          clienteId={clienteId}
          aoCancelar={() => setNovoCarro(false)}
          aoSalvar={() => {
            setNovoCarro(false);
            carros.recarregar();
          }}
        />
      </Dialogo>
    </Pagina>
  );
}
