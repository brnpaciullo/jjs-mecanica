import { useState } from 'react';
import { Delete } from 'lucide-react';
import { ErroDaApi, api } from '../api.js';

/**
 * Login por PIN com teclado próprio.
 *
 * Teclado na tela, e não `<input type="number">`: as teclas ficam grandes o
 * bastante para quem está de luva, e o teclado do sistema não cobre metade da
 * tela nem tenta autocompletar.
 */
export function Entrar({ aoEntrar }: { aoEntrar: () => void }) {
  const [pin, setPin] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function confirmar(valor: string) {
    setEnviando(true);
    setErro(null);
    try {
      await api.entrar(valor);
      aoEntrar();
    } catch (causa) {
      setPin('');
      setErro(
        causa instanceof ErroDaApi && causa.status === 429
          ? 'Muitas tentativas. Espere um minuto antes de tentar de novo.'
          : causa instanceof Error
            ? causa.message
            : 'PIN errado.',
      );
    } finally {
      setEnviando(false);
    }
  }

  function digitar(tecla: string) {
    if (enviando) return;
    setErro(null);

    if (tecla === 'apagar') {
      setPin((p) => p.slice(0, -1));
      return;
    }

    const novo = (pin + tecla).slice(0, 6);
    setPin(novo);
    // Confirma sozinho em 4 dígitos, que é o tamanho normal.
    if (novo.length === 4) void confirmar(novo);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-jjs-preto px-6 text-white">
      <div className="text-center">
        <p className="font-titulo text-4xl font-bold italic text-jjs-amarelo">JJS</p>
        <h1 className="mt-2 font-titulo text-2xl">Digite seu PIN</h1>
      </div>

      <div className="flex gap-3" aria-label={`${pin.length} de 4 dígitos`}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={
              'size-4 rounded-full border-2 border-white/40 ' +
              (i < pin.length ? 'bg-jjs-amarelo border-jjs-amarelo' : '')
            }
          />
        ))}
      </div>

      {erro ? <p className="max-w-xs text-center text-jjs-amarelo">{erro}</p> : null}

      <div className="grid w-full max-w-xs grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((t) => (
          <Tecla key={t} onClick={() => digitar(t)}>
            {t}
          </Tecla>
        ))}
        <span />
        <Tecla onClick={() => digitar('0')}>0</Tecla>
        <Tecla onClick={() => digitar('apagar')} rotulo="Apagar">
          <Delete size={28} />
        </Tecla>
      </div>

      {enviando ? <p className="text-white/70">Conferindo...</p> : null}
    </div>
  );
}

function Tecla({
  children,
  onClick,
  rotulo,
}: {
  children: React.ReactNode;
  onClick: () => void;
  rotulo?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      className="flex h-20 items-center justify-center rounded-card bg-jjs-grafite font-titulo text-3xl font-bold text-white active:bg-jjs-amarelo active:text-jjs-preto"
    >
      {children}
    </button>
  );
}
