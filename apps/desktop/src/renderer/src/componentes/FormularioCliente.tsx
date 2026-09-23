import { useState } from 'react';
import { mascararTelefone } from '@jjs/core';
import type { ClienteRegistro } from '@jjs/db';
import { Botao, Campo } from '@jjs/ui';
import { mensagemDeErro } from '../erro.js';
import { Aviso } from './Aviso.js';

export interface FormularioClienteProps {
  cliente?: ClienteRegistro | null;
  /** Nome já digitado em outro lugar (busca do atendimento), para não redigitar. */
  nomeInicial?: string;
  aoSalvar: (cliente: ClienteRegistro) => void;
  aoCancelar?: () => void;
}

/**
 * Cadastro rápido: só nome e telefone são obrigatórios. O resto o balcão
 * preenche depois, se precisar — na recepção o carro já está na porta.
 */
export function FormularioCliente({
  cliente,
  nomeInicial = '',
  aoSalvar,
  aoCancelar,
}: FormularioClienteProps) {
  const [nome, setNome] = useState(cliente?.nome ?? nomeInicial);
  const [telefone, setTelefone] = useState(
    cliente?.telefone ? mascararTelefone(cliente.telefone.replace(/^55/, '')) : '',
  );
  const [cpf, setCpf] = useState(cliente?.cpf ?? '');
  const [endereco, setEndereco] = useState(cliente?.endereco ?? '');
  const [observacoes, setObservacoes] = useState(cliente?.observacoes ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function enviar() {
    setSalvando(true);
    setErro(null);
    try {
      const dados = { nome, telefone, cpf, endereco, observacoes };
      const salvo = cliente
        ? await window.jjs.clientes.atualizar({ id: cliente.id, ...dados })
        : await window.jjs.clientes.criar(dados);
      aoSalvar(salvo);
    } catch (causa) {
      setErro(mensagemDeErro(causa));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
    >
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      <Campo
        rotulo="Nome do cliente"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Como o cliente se apresenta"
        autoFocus
        required
      />

      <Campo
        rotulo="Telefone (WhatsApp)"
        value={telefone}
        onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
        placeholder="(41) 99999-9999"
        ajuda="Se não digitar o DDD, o sistema usa 41."
        inputMode="tel"
        required
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="CPF (opcional)" value={cpf} onChange={(e) => setCpf(e.target.value)} />
        <Campo
          rotulo="Endereço (opcional)"
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="obs-cliente" className="text-sm font-semibold text-jjs-preto">
          Observações (opcional)
        </label>
        <textarea
          id="obs-cliente"
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={2}
          className="rounded-campo border border-jjs-borda bg-jjs-branco p-3"
        />
      </div>

      <div className="flex justify-end gap-3">
        {aoCancelar ? (
          <Botao variante="secundario" onClick={aoCancelar}>
            Cancelar
          </Botao>
        ) : null}
        <Botao type="submit" variante="principal" disabled={salvando}>
          {salvando ? 'Salvando...' : cliente ? 'Salvar alterações' : 'Cadastrar cliente'}
        </Botao>
      </div>
    </form>
  );
}
