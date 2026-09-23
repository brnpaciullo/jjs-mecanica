import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Car, Check, Fuel, Search, UserPlus } from 'lucide-react';
import { COMBUSTIVEL, formatarTelefone, type Combustivel } from '@jjs/core';
import type { ClienteRegistro, VeiculoRegistro } from '@jjs/db';
import { Botao, Campo, Placa, cn } from '@jjs/ui';
import { Pagina } from '../componentes/Pagina.js';
import { Aviso } from '../componentes/Aviso.js';
import { FormularioCliente } from '../componentes/FormularioCliente.js';
import { FormularioVeiculo } from '../componentes/FormularioVeiculo.js';
import { mensagemDeErro } from '../erro.js';

type Passo = 'cliente' | 'veiculo' | 'entrada';

/**
 * Recepção em três passos. A ordem é a do balcão: quem é, qual carro, o que
 * está acontecendo. Só queixas é obrigatório no último passo — o carro já está
 * na porta e o resto dá para preencher depois.
 */
export function AbrirAtendimento() {
  const navegar = useNavigate();
  const [passo, setPasso] = useState<Passo>('cliente');
  const [cliente, setCliente] = useState<ClienteRegistro | null>(null);
  const [veiculo, setVeiculo] = useState<VeiculoRegistro | null>(null);

  return (
    <Pagina
      titulo="Abrir atendimento"
      acoes={
        <Botao variante="secundario" icone={<ArrowLeft size={18} />} onClick={() => navegar('/')}>
          Voltar
        </Botao>
      }
    >
      <ol className="flex flex-wrap gap-2">
        {(
          [
            ['cliente', '1. Cliente', cliente?.nome],
            ['veiculo', '2. Carro', veiculo ? `${veiculo.marca} ${veiculo.modelo}` : null],
            ['entrada', '3. O que houve', null],
          ] as const
        ).map(([chave, rotulo, resumo]) => (
          <li
            key={chave}
            className={cn(
              'flex items-center gap-2 rounded-campo border px-3 py-2',
              passo === chave
                ? 'border-jjs-amarelo-escuro bg-jjs-amarelo/25 font-semibold'
                : 'border-jjs-borda bg-jjs-branco text-jjs-texto-fraco',
            )}
          >
            {resumo ? <Check size={16} className="text-jjs-verde" /> : null}
            {rotulo}
            {resumo ? <span className="font-normal">· {resumo}</span> : null}
          </li>
        ))}
      </ol>

      {passo === 'cliente' ? (
        <PassoCliente
          aoEscolher={(c) => {
            setCliente(c);
            setPasso('veiculo');
          }}
        />
      ) : null}

      {passo === 'veiculo' && cliente ? (
        <PassoVeiculo
          cliente={cliente}
          aoVoltar={() => setPasso('cliente')}
          aoEscolher={(v) => {
            setVeiculo(v);
            setPasso('entrada');
          }}
        />
      ) : null}

      {passo === 'entrada' && cliente && veiculo ? (
        <PassoEntrada
          cliente={cliente}
          veiculo={veiculo}
          aoVoltar={() => setPasso('veiculo')}
          aoCriar={(ordemId) => navegar(`/os/${ordemId}`)}
        />
      ) : null}
    </Pagina>
  );
}

function PassoCliente({ aoEscolher }: { aoEscolher: (cliente: ClienteRegistro) => void }) {
  const [termo, setTermo] = useState('');
  const [achados, setAchados] = useState<ClienteRegistro[]>([]);
  const [cadastrando, setCadastrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Busca enquanto digita, inclusive por placa: quem chega diz a placa antes
  // de dizer o nome.
  useEffect(() => {
    if (termo.trim().length < 2) return;
    let valendo = true;
    const timer = setTimeout(() => {
      Promise.all([window.jjs.clientes.listar(termo), window.jjs.veiculos.porPlaca(termo)])
        .then(async ([porNome, porPlaca]) => {
          if (!valendo) return;
          if (porPlaca) {
            const dono = await window.jjs.clientes.buscar(porPlaca.clienteId);
            if (dono && !porNome.some((c) => c.id === dono.id)) porNome.unshift(dono);
          }
          setAchados(porNome);
          setErro(null);
        })
        .catch((causa: unknown) => valendo && setErro(mensagemDeErro(causa)));
    }, 200);

    return () => {
      valendo = false;
      clearTimeout(timer);
    };
  }, [termo]);

  // Termo curto não lista nada, sem precisar zerar o estado num efeito.
  const visiveis = termo.trim().length >= 2 ? achados : [];

  if (cadastrando) {
    return (
      <section className="rounded-card border border-jjs-borda bg-jjs-branco p-5">
        <h2 className="mb-4 font-titulo text-2xl">Cadastro rápido</h2>
        <FormularioCliente
          nomeInicial={/\d/.test(termo) ? '' : termo}
          aoCancelar={() => setCadastrando(false)}
          aoSalvar={aoEscolher}
        />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-card border border-jjs-borda bg-jjs-branco p-5">
      <h2 className="font-titulo text-2xl">Quem é o cliente?</h2>

      <div className="relative">
        <Search
          size={22}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-jjs-texto-fraco"
          aria-hidden="true"
        />
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Nome, telefone ou placa do carro"
          aria-label="Procurar cliente"
          autoFocus
          className="min-h-14 w-full rounded-campo border border-jjs-borda pl-12 pr-3 text-lg"
        />
      </div>

      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      {visiveis.length > 0 ? (
        <ul className="divide-y divide-jjs-borda rounded-card border border-jjs-borda">
          {visiveis.map((cliente) => (
            <li key={cliente.id}>
              <button
                type="button"
                onClick={() => aoEscolher(cliente)}
                className="flex min-h-toque w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-jjs-papel"
              >
                <span className="font-semibold">{cliente.nome}</span>
                <span className="tabular-nums text-jjs-texto-fraco">
                  {formatarTelefone(cliente.telefone)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {termo.trim().length >= 2 && visiveis.length === 0 ? (
        <p className="text-jjs-texto-fraco">Não achei ninguém com &quot;{termo}&quot;.</p>
      ) : null}

      <div>
        <Botao
          variante="principal"
          tamanho="grande"
          icone={<UserPlus size={22} />}
          onClick={() => setCadastrando(true)}
        >
          Cliente novo
        </Botao>
      </div>
    </section>
  );
}

function PassoVeiculo({
  cliente,
  aoEscolher,
  aoVoltar,
}: {
  cliente: ClienteRegistro;
  aoEscolher: (veiculo: VeiculoRegistro) => void;
  aoVoltar: () => void;
}) {
  const [carros, setCarros] = useState<VeiculoRegistro[]>([]);
  const [cadastrando, setCadastrando] = useState(false);
  const [carregou, setCarregou] = useState(false);

  useEffect(() => {
    window.jjs.veiculos.doCliente(cliente.id).then((lista) => {
      setCarros(lista);
      // Cliente novo cai direto no cadastro do carro, sem uma lista vazia no meio.
      if (lista.length === 0) setCadastrando(true);
      setCarregou(true);
    });
  }, [cliente.id]);

  if (!carregou) return <p className="text-jjs-texto-fraco">Carregando...</p>;

  return (
    <section className="flex flex-col gap-4 rounded-card border border-jjs-borda bg-jjs-branco p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-titulo text-2xl">Qual carro do {cliente.nome}?</h2>
        <Botao variante="discreto" icone={<ArrowLeft size={18} />} onClick={aoVoltar}>
          Trocar cliente
        </Botao>
      </div>

      {cadastrando ? (
        <FormularioVeiculo
          clienteId={cliente.id}
          aoCancelar={carros.length > 0 ? () => setCadastrando(false) : undefined}
          aoSalvar={aoEscolher}
        />
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2">
            {carros.map((carro) => (
              <li key={carro.id}>
                <button
                  type="button"
                  onClick={() => aoEscolher(carro)}
                  className="flex w-full items-center gap-4 rounded-card border border-jjs-borda p-4 text-left hover:border-jjs-amarelo-escuro"
                >
                  <Placa placa={carro.placa} tamanho="pequena" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {carro.marca} {carro.modelo}
                    </span>
                    <span className="block text-sm text-jjs-texto-fraco">
                      {[carro.ano, carro.cor].filter(Boolean).join(' · ') || 'Sem detalhes'}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div>
            <Botao
              variante="secundario"
              icone={<Car size={20} />}
              onClick={() => setCadastrando(true)}
            >
              Outro carro
            </Botao>
          </div>
        </>
      )}
    </section>
  );
}

function PassoEntrada({
  cliente,
  veiculo,
  aoCriar,
  aoVoltar,
}: {
  cliente: ClienteRegistro;
  veiculo: VeiculoRegistro;
  aoCriar: (ordemId: number) => void;
  aoVoltar: () => void;
}) {
  const [queixas, setQueixas] = useState('');
  const [km, setKm] = useState(veiculo.kmAtual ? String(veiculo.kmAtual) : '');
  const [combustivel, setCombustivel] = useState<Combustivel | ''>('');
  const [avarias, setAvarias] = useState('');
  const [objetos, setObjetos] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  async function criar() {
    setCriando(true);
    setErro(null);
    try {
      const ordem = await window.jjs.ordens.criar({
        clienteId: cliente.id,
        veiculoId: veiculo.id,
        queixas,
        kmEntrada: km ? Number(km.replace(/\D/g, '')) : null,
        combustivel: combustivel || null,
        checklistEntrada:
          avarias || objetos
            ? {
                avarias: avarias ? avarias.split('\n').filter(Boolean) : [],
                objetos: objetos ? objetos.split('\n').filter(Boolean) : [],
                observacoes: '',
              }
            : null,
      });
      aoCriar(ordem.id);
    } catch (causa) {
      setErro(mensagemDeErro(causa));
      setCriando(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-5 rounded-card border border-jjs-borda bg-jjs-branco p-5"
      onSubmit={(e) => {
        e.preventDefault();
        void criar();
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <Placa placa={veiculo.placa} tamanho="media" />
          <div>
            <p className="font-semibold">
              {veiculo.marca} {veiculo.modelo}
            </p>
            <p className="text-sm text-jjs-texto-fraco">{cliente.nome}</p>
          </div>
        </div>
        <Botao variante="discreto" icone={<ArrowLeft size={18} />} onClick={aoVoltar}>
          Trocar carro
        </Botao>
      </div>

      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="queixas" className="text-lg font-semibold text-jjs-preto">
          O que o cliente falou?
        </label>
        <textarea
          id="queixas"
          value={queixas}
          onChange={(e) => setQueixas(e.target.value)}
          rows={5}
          autoFocus
          required
          placeholder="Com as palavras do cliente. Ex: está fazendo barulho na frente quando freia, e o câmbio demora para engatar."
          className="rounded-campo border border-jjs-borda p-3 text-lg"
        />
        <p className="text-sm text-jjs-texto-fraco">
          É o único campo obrigatório. O diagnóstico da oficina vem depois, na tela da OS.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo
          rotulo="Km de entrada (opcional)"
          value={km}
          onChange={(e) => setKm(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          placeholder="87000"
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-jjs-preto">
            <Fuel size={16} className="mr-1 inline" aria-hidden="true" />
            Combustível (opcional)
          </span>
          <div className="flex flex-wrap gap-2">
            {COMBUSTIVEL.map((nivel) => (
              <button
                key={nivel}
                type="button"
                onClick={() => setCombustivel(combustivel === nivel ? '' : nivel)}
                className={cn(
                  'min-h-toque rounded-campo border px-4 font-semibold',
                  combustivel === nivel
                    ? 'border-jjs-amarelo-escuro bg-jjs-amarelo text-jjs-preto'
                    : 'border-jjs-borda bg-jjs-branco hover:bg-jjs-papel',
                )}
              >
                {nivel}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="avarias" className="text-sm font-semibold text-jjs-preto">
            Avarias que já vieram (opcional)
          </label>
          <textarea
            id="avarias"
            value={avarias}
            onChange={(e) => setAvarias(e.target.value)}
            rows={3}
            placeholder={'Uma por linha\nRisco no para-choque'}
            className="rounded-campo border border-jjs-borda p-3"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="objetos" className="text-sm font-semibold text-jjs-preto">
            Objetos no carro (opcional)
          </label>
          <textarea
            id="objetos"
            value={objetos}
            onChange={(e) => setObjetos(e.target.value)}
            rows={3}
            placeholder={'Um por linha\nCadeirinha de criança'}
            className="rounded-campo border border-jjs-borda p-3"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Botao
          type="submit"
          variante="principal"
          tamanho="grande"
          disabled={criando || !queixas.trim()}
        >
          {criando ? 'Abrindo...' : 'Abrir atendimento'}
        </Botao>
      </div>
    </form>
  );
}
