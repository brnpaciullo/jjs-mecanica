import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, ClipboardList, Search, User } from 'lucide-react';
import type { ResultadoBusca } from '@jjs/db';
import { cn, Placa } from '@jjs/ui';
import { mensagemDeErro } from '../erro.js';
import { ABRIR_BUSCA } from '../eventos.js';

const ICONE = { veiculo: Car, cliente: User, ordem: ClipboardList } as const;

/**
 * Busca global do Ctrl+K: um campo só que acha placa, nome, telefone e número
 * de OS. É o atalho central do sistema — na oficina a pergunta quase sempre
 * começa pela placa.
 */
export function BuscaGlobal() {
  const navegar = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState<ResultadoBusca[]>([]);
  const [selecionado, setSelecionado] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  // Ctrl+K (e Cmd+K) abre de qualquer lugar; o botão da lateral avisa pelo
  // evento interno, para o atalho e o clique caírem no mesmo lugar.
  useEffect(() => {
    const abrir = () => setAberto(true);
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        abrir();
      }
    };
    document.addEventListener('keydown', aoTeclar);
    document.addEventListener(ABRIR_BUSCA, abrir);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.removeEventListener(ABRIR_BUSCA, abrir);
    };
  }, []);

  useEffect(() => {
    if (aberto) setTimeout(() => campo.current?.focus(), 0);
  }, [aberto]);

  // Fechar limpa tudo aqui, no próprio gesto de fechar — mais direto que um
  // efeito reagindo a `aberto`, e sem renderização em cascata.
  const fechar = useCallback(() => {
    setAberto(false);
    setTermo('');
    setResultados([]);
    setSelecionado(0);
    setErro(null);
  }, []);

  // Espera a digitação parar: a cada tecla seria consulta demais no banco.
  useEffect(() => {
    if (!aberto || termo.trim().length < 2) return;

    let valendo = true;
    const timer = setTimeout(() => {
      window.jjs.busca
        .global(termo)
        .then((achados) => {
          if (!valendo) return;
          setResultados(achados);
          setSelecionado(0);
          setErro(null);
        })
        .catch((causa: unknown) => valendo && setErro(mensagemDeErro(causa)));
    }, 180);

    return () => {
      valendo = false;
      clearTimeout(timer);
    };
  }, [termo, aberto]);

  // Enquanto o termo é curto nada é listado, sem precisar zerar o estado.
  const visiveis = termo.trim().length >= 2 ? resultados : [];

  function escolher(resultado: ResultadoBusca | undefined) {
    if (!resultado) return;
    fechar();
    navegar(resultado.rota);
  }

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 p-6 pt-24"
      onMouseDown={(e) => e.target === e.currentTarget && fechar()}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-card bg-jjs-branco shadow-xl">
        <div className="flex items-center gap-3 border-b border-jjs-borda px-4">
          <Search size={22} className="shrink-0 text-jjs-texto-fraco" aria-hidden="true" />
          <input
            ref={campo}
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Placa, nome do cliente, telefone ou número da OS"
            aria-label="Busca"
            className="min-h-14 w-full bg-transparent text-lg outline-none placeholder:text-jjs-texto-fraco"
            onKeyDown={(e) => {
              if (e.key === 'Escape') fechar();
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelecionado((i) => Math.min(i + 1, visiveis.length - 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelecionado((i) => Math.max(i - 1, 0));
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                escolher(visiveis[selecionado]);
              }
            }}
          />
        </div>

        <div className="max-h-96 overflow-y-auto">
          {erro ? <p className="px-4 py-6 text-jjs-vermelho">{erro}</p> : null}

          {!erro && termo.trim().length < 2 ? (
            <p className="px-4 py-6 text-jjs-texto-fraco">
              Digite pelo menos duas letras. Dá para procurar por ABC-1234, pelo nome do cliente,
              pelo telefone ou por &quot;OS 12&quot;.
            </p>
          ) : null}

          {!erro && termo.trim().length >= 2 && visiveis.length === 0 ? (
            <p className="px-4 py-6 text-jjs-texto-fraco">
              Não achei nada com &quot;{termo}&quot;.
            </p>
          ) : null}

          <ul>
            {visiveis.map((resultado, i) => {
              const Icone = ICONE[resultado.tipo];
              return (
                <li key={`${resultado.tipo}-${resultado.id}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setSelecionado(i)}
                    onClick={() => escolher(resultado)}
                    className={cn(
                      'flex min-h-toque w-full items-center gap-3 px-4 py-2.5 text-left',
                      i === selecionado ? 'bg-jjs-amarelo/25' : 'hover:bg-jjs-papel',
                    )}
                  >
                    <Icone size={20} className="shrink-0 text-jjs-texto-fraco" aria-hidden="true" />
                    {resultado.tipo === 'veiculo' && resultado.placa ? (
                      <Placa placa={resultado.placa} tamanho="pequena" />
                    ) : (
                      <span className="font-semibold text-jjs-preto">{resultado.titulo}</span>
                    )}
                    <span className="truncate text-jjs-texto-fraco">{resultado.detalhe}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <footer className="border-t border-jjs-borda px-4 py-2 text-sm text-jjs-texto-fraco">
          Use ↑ ↓ para escolher, Enter para abrir, Esc para fechar.
        </footer>
      </div>
    </div>
  );
}
