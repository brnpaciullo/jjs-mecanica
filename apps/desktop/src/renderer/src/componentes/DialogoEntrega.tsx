import { useState } from 'react';
import { formatarDinheiro } from '@jjs/core';
import { Botao, Campo } from '@jjs/ui';
import { Dialogo } from './Dialogo.js';
import { Aviso } from './Aviso.js';
import { mensagemDeErro } from '../erro.js';

export interface DialogoEntregaProps {
  aberto: boolean;
  ordemId: number;
  totalCentavos: number;
  kmEntrada: number | null;
  formaPagamentoAtual: string | null;
  aoEntregar: () => void;
  aoCancelar: () => void;
}

const FORMAS = ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência'];

/**
 * Entregar o carro é o único momento em que o balcão precisa fechar a conta.
 * Por isso a entrega pergunta forma de pagamento e o km de saída, em vez de
 * deixar esses campos para alguém lembrar de preencher depois.
 *
 * O km informado aqui atualiza o cadastro do carro — é o que mantém o
 * histórico de quilometragem útil entre uma revisão e outra.
 */
export function DialogoEntrega({
  aberto,
  ordemId,
  totalCentavos,
  kmEntrada,
  formaPagamentoAtual,
  aoEntregar,
  aoCancelar,
}: DialogoEntregaProps) {
  const [forma, setForma] = useState(formaPagamentoAtual ?? '');
  const [km, setKm] = useState('');
  const [pago, setPago] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const kmNumero = km ? Number(km.replace(/\D/g, '')) : null;
  // Km menor que o da entrada quase sempre é dígito trocado.
  const kmSuspeito = kmNumero !== null && kmEntrada !== null && kmNumero < kmEntrada;

  async function entregar() {
    setSalvando(true);
    setErro(null);
    try {
      await window.jjs.ordens.mudarStatus({
        id: ordemId,
        status: 'entregue',
        formaPagamento: forma || null,
        kmSaida: kmSuspeito ? null : kmNumero,
      });
      await window.jjs.ordens.atualizar({ id: ordemId, pago });
      aoEntregar();
    } catch (causa) {
      setErro(mensagemDeErro(causa));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialogo
      titulo="Entregar o carro"
      aberto={aberto}
      aoFechar={aoCancelar}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoCancelar}>
            Cancelar
          </Botao>
          <Botao variante="principal" onClick={() => void entregar()} disabled={salvando}>
            {salvando ? 'Entregando...' : 'Entregar'}
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

        <p className="font-titulo text-3xl text-jjs-preto">
          Total: {formatarDinheiro(totalCentavos)}
        </p>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-jjs-preto">Como o cliente pagou?</span>
          <div className="flex flex-wrap gap-2">
            {FORMAS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setForma(forma === f ? '' : f)}
                className={
                  'min-h-toque rounded-campo border px-4 font-semibold ' +
                  (forma === f
                    ? 'border-jjs-amarelo-escuro bg-jjs-amarelo text-jjs-preto'
                    : 'border-jjs-borda bg-jjs-branco hover:bg-jjs-papel')
                }
              >
                {f}
              </button>
            ))}
          </div>
          <Campo
            rotulo="Ou escreva de outro jeito"
            value={FORMAS.includes(forma) ? '' : forma}
            onChange={(e) => setForma(e.target.value)}
            placeholder="Cartão em 3x sem juros"
          />
        </div>

        <Campo
          rotulo="Km na saída (opcional)"
          value={km}
          onChange={(e) => setKm(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          placeholder={kmEntrada ? String(kmEntrada) : '87050'}
          erro={
            kmSuspeito
              ? `Esse km é menor que o da entrada (${kmEntrada?.toLocaleString('pt-BR')}). Confira antes de entregar — se estiver errado, o km do carro não será atualizado.`
              : null
          }
          ajuda={kmSuspeito ? null : 'Atualiza a quilometragem no cadastro do carro.'}
        />

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={pago}
            onChange={(e) => setPago(e.target.checked)}
            className="size-5"
          />
          <span className="text-lg">Já foi pago</span>
        </label>
      </div>
    </Dialogo>
  );
}
