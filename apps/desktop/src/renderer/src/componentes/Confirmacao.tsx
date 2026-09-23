import { Botao } from '@jjs/ui';
import { Dialogo } from './Dialogo.js';

export interface ConfirmacaoProps {
  aberto: boolean;
  titulo: string;
  /** Escrito em linguagem clara, dizendo o que vai acontecer de verdade. */
  mensagem: string;
  rotuloConfirmar?: string;
  perigo?: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}

/** Toda ação que desfaz alguma coisa passa por aqui antes de acontecer. */
export function Confirmacao({
  aberto,
  titulo,
  mensagem,
  rotuloConfirmar = 'Confirmar',
  perigo = false,
  aoConfirmar,
  aoCancelar,
}: ConfirmacaoProps) {
  return (
    <Dialogo
      titulo={titulo}
      aberto={aberto}
      aoFechar={aoCancelar}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoCancelar}>
            Cancelar
          </Botao>
          <Botao variante={perigo ? 'perigo' : 'principal'} onClick={aoConfirmar} autoFocus>
            {rotuloConfirmar}
          </Botao>
        </>
      }
    >
      <p className="text-lg leading-relaxed text-jjs-preto">{mensagem}</p>
    </Dialogo>
  );
}
