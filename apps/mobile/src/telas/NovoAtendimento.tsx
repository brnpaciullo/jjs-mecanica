import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import {
  COMBUSTIVEL,
  formatarPlaca,
  mascararTelefone,
  normalizarPlaca,
  type Combustivel,
} from '@jjs/core';
import { api } from '../api.js';
import { Cabecalho } from '../componentes/Cabecalho.js';

type Achados = Awaited<ReturnType<typeof api.buscar>>;

/**
 * Recepção pelo celular, versão curta.
 *
 * No balcão são três passos; aqui é uma tela só. O mecânico costuma abrir
 * atendimento com o carro na frente dele e uma mão ocupada — navegar por
 * etapas seria pior do que rolar a página.
 */
export function NovoAtendimento() {
  const navegar = useNavigate();
  const [termo, setTermo] = useState('');
  const [achados, setAchados] = useState<Achados>({ clientes: [], veiculos: [] });

  const [veiculoId, setVeiculoId] = useState<number | null>(null);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [resumo, setResumo] = useState<string | null>(null);

  // Cadastro na hora, quando o carro não está no sistema
  const [placa, setPlaca] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');

  const [queixas, setQueixas] = useState('');
  const [km, setKm] = useState('');
  const [combustivel, setCombustivel] = useState<Combustivel | ''>('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (termo.trim().length < 2) return;
    let valendo = true;
    const t = setTimeout(() => {
      void api.buscar(termo).then((r) => valendo && setAchados(r));
    }, 250);
    return () => {
      valendo = false;
      clearTimeout(t);
    };
  }, [termo]);

  const visiveis = termo.trim().length >= 2 ? achados : { clientes: [], veiculos: [] };
  const jaEscolheu = veiculoId !== null || (placa && marca && modelo && nome && telefone);

  async function abrir() {
    setSalvando(true);
    setErro(null);
    try {
      const ordem = await api.abrirAtendimento({
        clienteId,
        veiculoId,
        clienteNome: nome,
        clienteTelefone: telefone,
        placa,
        marca,
        modelo,
        queixas,
        kmEntrada: km ? Number(km.replace(/\D/g, '')) : null,
        combustivel: combustivel || null,
      });
      navegar(`/os/${ordem.id}`);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não consegui abrir o atendimento.');
      setSalvando(false);
    }
  }

  return (
    <div className="min-h-screen bg-jjs-papel pb-8">
      <Cabecalho titulo="Abrir atendimento" voltarPara="/" />

      <div className="flex flex-col gap-3 p-3">
        {erro ? <p className="rounded-card bg-jjs-vermelho/15 p-3">{erro}</p> : null}

        {resumo ? (
          <section className="flex items-center justify-between gap-3 rounded-card border border-jjs-verde bg-jjs-verde/10 p-4">
            <span className="min-w-0">
              <span className="block text-sm text-jjs-texto-fraco">Carro escolhido</span>
              <span className="block truncate font-semibold">{resumo}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setVeiculoId(null);
                setClienteId(null);
                setResumo(null);
              }}
              className="min-h-11 shrink-0 rounded-campo border border-jjs-borda px-3"
            >
              Trocar
            </button>
          </section>
        ) : (
          <>
            <section className="rounded-card border border-jjs-borda bg-jjs-branco p-4">
              <h2 className="font-titulo text-xl">O carro já é conhecido?</h2>
              <div className="relative mt-2">
                <Search
                  size={20}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-jjs-texto-fraco"
                />
                <input
                  value={termo}
                  onChange={(e) => setTermo(e.target.value)}
                  placeholder="Placa ou nome do cliente"
                  className="min-h-14 w-full rounded-campo border border-jjs-borda pl-11 pr-3"
                />
              </div>

              {visiveis.veiculos.length > 0 ? (
                <ul className="mt-2 divide-y divide-jjs-borda rounded-campo border border-jjs-borda">
                  {visiveis.veiculos.map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setVeiculoId(v.id);
                          setClienteId(v.clienteId);
                          setResumo(
                            `${formatarPlaca(v.placa)} · ${v.marca} ${v.modelo} · ${v.clienteNome}`,
                          );
                        }}
                        className="flex min-h-14 w-full items-center gap-3 px-3 text-left active:bg-jjs-papel"
                      >
                        <span className="rounded-[4px] border-2 border-jjs-preto bg-white px-1.5 font-titulo font-bold">
                          {formatarPlaca(v.placa)}
                        </span>
                        <span className="min-w-0 truncate">
                          {v.marca} {v.modelo} · {v.clienteNome}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            <section className="rounded-card border border-jjs-borda bg-jjs-branco p-4">
              <h2 className="font-titulo text-xl">Ou cadastre agora</h2>
              <div className="mt-2 flex flex-col gap-2">
                <input
                  value={formatarPlaca(placa)}
                  onChange={(e) => setPlaca(normalizarPlaca(e.target.value))}
                  placeholder="Placa"
                  className="min-h-14 rounded-campo border border-jjs-borda px-3 font-titulo text-xl tracking-wider"
                />
                <div className="flex gap-2">
                  <input
                    value={marca}
                    onChange={(e) => setMarca(e.target.value)}
                    placeholder="Marca"
                    className="min-h-14 flex-1 rounded-campo border border-jjs-borda px-3"
                  />
                  <input
                    value={modelo}
                    onChange={(e) => setModelo(e.target.value)}
                    placeholder="Modelo"
                    className="min-h-14 flex-1 rounded-campo border border-jjs-borda px-3"
                  />
                </div>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome do cliente"
                  className="min-h-14 rounded-campo border border-jjs-borda px-3"
                />
                <input
                  value={telefone}
                  onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
                  inputMode="tel"
                  placeholder="Telefone (WhatsApp)"
                  className="min-h-14 rounded-campo border border-jjs-borda px-3"
                />
              </div>
            </section>
          </>
        )}

        <section className="rounded-card border border-jjs-borda bg-jjs-branco p-4">
          <h2 className="font-titulo text-xl">O que o cliente falou?</h2>
          <textarea
            value={queixas}
            onChange={(e) => setQueixas(e.target.value)}
            rows={4}
            placeholder="Com as palavras dele. Ex: barulho na frente quando freia."
            className="mt-2 w-full rounded-campo border border-jjs-borda p-3"
          />

          <div className="mt-3 flex gap-2">
            <input
              value={km}
              onChange={(e) => setKm(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              placeholder="Km (opcional)"
              className="min-h-14 flex-1 rounded-campo border border-jjs-borda px-3"
            />
          </div>

          <p className="mt-3 text-sm font-semibold text-jjs-texto-fraco">Combustível (opcional)</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {COMBUSTIVEL.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCombustivel(combustivel === c ? '' : c)}
                className={
                  'min-h-12 rounded-campo border px-4 font-semibold ' +
                  (combustivel === c
                    ? 'border-jjs-amarelo-escuro bg-jjs-amarelo'
                    : 'border-jjs-borda')
                }
              >
                {c}
              </button>
            ))}
          </div>
        </section>

        <button
          type="button"
          disabled={salvando || !queixas.trim() || !jaEscolheu}
          onClick={() => void abrir()}
          className="min-h-16 rounded-card bg-jjs-amarelo font-titulo text-xl font-bold text-jjs-preto disabled:opacity-50"
        >
          {salvando ? 'Abrindo...' : 'Abrir atendimento'}
        </button>
      </div>
    </div>
  );
}
