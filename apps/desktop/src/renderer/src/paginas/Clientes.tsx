import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, UserPlus, Users } from 'lucide-react';
import { formatarTelefone } from '@jjs/core';
import type { ClienteRegistro } from '@jjs/db';
import { Botao, EstadoVazio } from '@jjs/ui';
import { Pagina } from '../componentes/Pagina.js';
import { Dialogo } from '../componentes/Dialogo.js';
import { Aviso } from '../componentes/Aviso.js';
import { FormularioCliente } from '../componentes/FormularioCliente.js';
import { useConsulta } from '../hooks/useConsulta.js';

export function Clientes() {
  const [termo, setTermo] = useState('');
  const [novoAberto, setNovoAberto] = useState(false);

  const { dados, carregando, erro, recarregar } = useConsulta<ClienteRegistro[]>(
    () => window.jjs.clientes.listar(termo),
    [termo],
  );

  const clientes = dados ?? [];

  return (
    <Pagina
      titulo="Clientes"
      acoes={
        <Botao variante="principal" icone={<Plus size={20} />} onClick={() => setNovoAberto(true)}>
          Novo cliente
        </Botao>
      }
    >
      <div className="relative">
        <Search
          size={20}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-jjs-texto-fraco"
          aria-hidden="true"
        />
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Procurar por nome, telefone ou CPF"
          aria-label="Procurar cliente"
          className="min-h-toque w-full rounded-campo border border-jjs-borda bg-jjs-branco pl-11 pr-3"
        />
      </div>

      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      {!carregando && clientes.length === 0 ? (
        <EstadoVazio
          icone={<Users size={44} />}
          titulo={termo ? 'Nenhum cliente com esse nome' : 'Nenhum cliente cadastrado'}
          descricao={
            termo
              ? 'Confira a escrita ou cadastre um cliente novo.'
              : 'Os clientes também são cadastrados na hora de abrir o atendimento.'
          }
          acao={
            <Botao
              variante="principal"
              icone={<UserPlus size={20} />}
              onClick={() => setNovoAberto(true)}
            >
              Cadastrar cliente
            </Botao>
          }
        />
      ) : null}

      {clientes.length > 0 ? (
        <ul className="divide-y divide-jjs-borda overflow-hidden rounded-card border border-jjs-borda bg-jjs-branco">
          {clientes.map((cliente) => (
            <li key={cliente.id}>
              <Link
                to={`/clientes/${cliente.id}`}
                className="flex min-h-toque items-center justify-between gap-4 px-4 py-3 hover:bg-jjs-papel"
              >
                <span className="font-semibold text-jjs-preto">{cliente.nome}</span>
                <span className="tabular-nums text-jjs-texto-fraco">
                  {formatarTelefone(cliente.telefone)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <Dialogo titulo="Novo cliente" aberto={novoAberto} aoFechar={() => setNovoAberto(false)}>
        <FormularioCliente
          aoCancelar={() => setNovoAberto(false)}
          aoSalvar={() => {
            setNovoAberto(false);
            recarregar();
          }}
        />
      </Dialogo>
    </Pagina>
  );
}
