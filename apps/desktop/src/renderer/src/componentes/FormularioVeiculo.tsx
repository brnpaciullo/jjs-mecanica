import { useState } from 'react';
import { ehPlacaValida, formatarPlaca, normalizarPlaca } from '@jjs/core';
import type { VeiculoRegistro } from '@jjs/db';
import { Botao, Campo } from '@jjs/ui';
import { mensagemDeErro } from '../erro.js';
import { Aviso } from './Aviso.js';

export interface FormularioVeiculoProps {
  clienteId: number;
  veiculo?: VeiculoRegistro | null;
  placaInicial?: string;
  aoSalvar: (veiculo: VeiculoRegistro) => void;
  aoCancelar?: () => void;
}

const COMBUSTIVEL_VAZIO = '';

export function FormularioVeiculo({
  clienteId,
  veiculo,
  placaInicial = '',
  aoSalvar,
  aoCancelar,
}: FormularioVeiculoProps) {
  const [marca, setMarca] = useState(veiculo?.marca ?? '');
  const [modelo, setModelo] = useState(veiculo?.modelo ?? '');
  const [placa, setPlaca] = useState(veiculo?.placa ?? normalizarPlaca(placaInicial));
  const [ano, setAno] = useState(veiculo?.ano ? String(veiculo.ano) : COMBUSTIVEL_VAZIO);
  const [cor, setCor] = useState(veiculo?.cor ?? '');
  const [km, setKm] = useState(veiculo?.kmAtual ? String(veiculo.kmAtual) : '');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // A placa só é cobrada depois de digitada por inteiro, para o erro não
  // aparecer na primeira letra.
  const placaRuim = placa.length >= 7 && !ehPlacaValida(placa);

  async function enviar() {
    setSalvando(true);
    setErro(null);
    try {
      const dados = {
        clienteId,
        marca,
        modelo,
        placa,
        ano: ano ? Number(ano) : null,
        cor,
        kmAtual: km ? Number(km.replace(/\D/g, '')) : null,
      };
      const salvo = veiculo
        ? await window.jjs.veiculos.atualizar({ id: veiculo.id, ...dados })
        : await window.jjs.veiculos.criar(dados);
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
        rotulo="Placa"
        value={formatarPlaca(placa)}
        onChange={(e) => setPlaca(normalizarPlaca(e.target.value))}
        placeholder="ABC-1234 ou ABC1D23"
        erro={placaRuim ? 'Confira a placa. Use ABC-1234 ou ABC1D23.' : null}
        ajuda={placaRuim ? null : 'Serve o formato antigo e o Mercosul.'}
        className="font-titulo text-xl tracking-wider"
        autoFocus={!veiculo}
        required
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          rotulo="Marca"
          value={marca}
          onChange={(e) => setMarca(e.target.value)}
          placeholder="Volkswagen"
          required
        />
        <Campo
          rotulo="Modelo"
          value={modelo}
          onChange={(e) => setModelo(e.target.value)}
          placeholder="Gol 1.0"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Campo
          rotulo="Ano (opcional)"
          value={ano}
          onChange={(e) => setAno(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          placeholder="2018"
        />
        <Campo
          rotulo="Cor (opcional)"
          value={cor}
          onChange={(e) => setCor(e.target.value)}
          placeholder="Prata"
        />
        <Campo
          rotulo="Km atual (opcional)"
          value={km}
          onChange={(e) => setKm(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          placeholder="87000"
        />
      </div>

      <div className="flex justify-end gap-3">
        {aoCancelar ? (
          <Botao variante="secundario" onClick={aoCancelar}>
            Cancelar
          </Botao>
        ) : null}
        <Botao type="submit" variante="principal" disabled={salvando || placaRuim}>
          {salvando ? 'Salvando...' : veiculo ? 'Salvar alterações' : 'Cadastrar carro'}
        </Botao>
      </div>
    </form>
  );
}
