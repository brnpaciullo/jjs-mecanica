import { useState } from 'react';
import { BookOpen, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { CATEGORIAS, formatarDinheiro, TIPOS_ITEM, type Categoria, type TipoItem } from '@jjs/core';
import type { CatalogoRegistro } from '@jjs/db';
import { Botao, Campo, EstadoVazio } from '@jjs/ui';
import { Pagina } from '../componentes/Pagina.js';
import { Dialogo } from '../componentes/Dialogo.js';
import { Confirmacao } from '../componentes/Confirmacao.js';
import { Aviso } from '../componentes/Aviso.js';
import { CampoDinheiro } from '../componentes/CampoDinheiro.js';
import { useConsulta } from '../hooks/useConsulta.js';
import { mensagemDeErro } from '../erro.js';

const ROTULO_TIPO: Record<TipoItem, string> = { peca: 'Peça', mao_de_obra: 'Mão de obra' };

export function Catalogo() {
  const [termo, setTermo] = useState('');
  const [editando, setEditando] = useState<CatalogoRegistro | null>(null);
  const [criando, setCriando] = useState(false);
  const [paraArquivar, setParaArquivar] = useState<CatalogoRegistro | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const { dados, carregando, erro, recarregar } = useConsulta<CatalogoRegistro[]>(
    () => window.jjs.catalogo.listar(termo),
    [termo],
  );

  const itens = dados ?? [];
  // Agrupado por categoria: é assim que a oficina pensa os serviços.
  const porCategoria = new Map<string, CatalogoRegistro[]>();
  for (const item of itens) {
    const chave = item.categoria ?? 'Sem categoria';
    const lista = porCategoria.get(chave) ?? [];
    lista.push(item);
    porCategoria.set(chave, lista);
  }

  async function arquivar() {
    if (!paraArquivar) return;
    try {
      await window.jjs.catalogo.arquivar(paraArquivar.id, false);
      setParaArquivar(null);
      setErroAcao(null);
      recarregar();
    } catch (causa) {
      setErroAcao(mensagemDeErro(causa));
    }
  }

  return (
    <Pagina
      titulo="Catálogo"
      acoes={
        <Botao variante="principal" icone={<Plus size={20} />} onClick={() => setCriando(true)}>
          Novo item
        </Botao>
      }
    >
      <p className="text-jjs-texto-fraco">
        As peças e serviços daqui aparecem no autocompletar da OS, já com o valor preenchido.
      </p>

      <div className="relative">
        <Search
          size={20}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-jjs-texto-fraco"
          aria-hidden="true"
        />
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Procurar no catálogo"
          aria-label="Procurar no catálogo"
          className="min-h-toque w-full rounded-campo border border-jjs-borda bg-jjs-branco pl-11 pr-3"
        />
      </div>

      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {erroAcao ? <Aviso tom="erro">{erroAcao}</Aviso> : null}

      {!carregando && itens.length === 0 ? (
        <EstadoVazio
          icone={<BookOpen size={44} />}
          titulo={termo ? 'Nada encontrado no catálogo' : 'Catálogo vazio'}
          descricao="Cadastre o que a oficina mais faz para não redigitar em toda OS."
          acao={
            <Botao variante="principal" onClick={() => setCriando(true)}>
              Cadastrar item
            </Botao>
          }
        />
      ) : null}

      {[...porCategoria.entries()].map(([categoria, lista]) => (
        <section key={categoria}>
          <h2 className="mb-2 font-titulo text-2xl text-jjs-preto">{categoria}</h2>
          <ul className="divide-y divide-jjs-borda overflow-hidden rounded-card border border-jjs-borda bg-jjs-branco">
            {lista.map((item) => (
              <li
                key={item.id}
                className="flex min-h-toque flex-wrap items-center gap-3 px-4 py-2.5"
              >
                <span className="flex-1 font-medium text-jjs-preto">{item.descricao}</span>
                <span className="rounded-campo border border-jjs-borda px-2 py-0.5 text-sm text-jjs-texto-fraco">
                  {ROTULO_TIPO[item.tipo]}
                </span>
                <span className="w-28 text-right tabular-nums">
                  {item.valorPadraoCentavos === null ? (
                    <span className="text-jjs-texto-fraco">a combinar</span>
                  ) : (
                    formatarDinheiro(item.valorPadraoCentavos)
                  )}
                </span>
                <Botao
                  variante="discreto"
                  className="min-h-10 px-2"
                  aria-label={`Editar ${item.descricao}`}
                  onClick={() => setEditando(item)}
                >
                  <Pencil size={18} />
                </Botao>
                <Botao
                  variante="discreto"
                  className="min-h-10 px-2 text-jjs-vermelho"
                  aria-label={`Tirar ${item.descricao} do catálogo`}
                  onClick={() => setParaArquivar(item)}
                >
                  <Trash2 size={18} />
                </Botao>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Dialogo
        titulo={editando ? 'Editar item' : 'Novo item do catálogo'}
        aberto={criando || editando !== null}
        aoFechar={() => {
          setCriando(false);
          setEditando(null);
        }}
      >
        <FormularioCatalogo
          item={editando}
          aoCancelar={() => {
            setCriando(false);
            setEditando(null);
          }}
          aoSalvar={() => {
            setCriando(false);
            setEditando(null);
            recarregar();
          }}
        />
      </Dialogo>

      <Confirmacao
        aberto={paraArquivar !== null}
        titulo="Tirar do catálogo"
        mensagem={
          paraArquivar
            ? `"${paraArquivar.descricao}" vai sumir do autocompletar da OS. As OS antigas que já usaram esse item continuam iguais.`
            : ''
        }
        rotuloConfirmar="Tirar do catálogo"
        perigo
        aoConfirmar={() => void arquivar()}
        aoCancelar={() => setParaArquivar(null)}
      />
    </Pagina>
  );
}

function FormularioCatalogo({
  item,
  aoSalvar,
  aoCancelar,
}: {
  item: CatalogoRegistro | null;
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const [descricao, setDescricao] = useState(item?.descricao ?? '');
  const [tipo, setTipo] = useState<TipoItem>(item?.tipo ?? 'mao_de_obra');
  const [categoria, setCategoria] = useState<Categoria | ''>(item?.categoria ?? '');
  const [valor, setValor] = useState(item?.valorPadraoCentavos ?? 0);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function enviar() {
    setSalvando(true);
    setErro(null);
    try {
      const dados = {
        descricao,
        tipo,
        categoria: categoria || null,
        // Zero vira "a combinar": peça sem preço fixo é o caso normal.
        valorPadraoCentavos: valor > 0 ? valor : null,
      };
      if (item) await window.jjs.catalogo.atualizar({ id: item.id, ...dados });
      else await window.jjs.catalogo.criar(dados);
      aoSalvar();
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
        rotulo="Descrição"
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        placeholder="Troca de pastilhas de freio"
        autoFocus
        required
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tipo-cat" className="text-sm font-semibold text-jjs-preto">
            Tipo
          </label>
          <select
            id="tipo-cat"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoItem)}
            className="min-h-toque rounded-campo border border-jjs-borda bg-jjs-branco px-3"
          >
            {TIPOS_ITEM.map((t) => (
              <option key={t} value={t}>
                {ROTULO_TIPO[t]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cat-cat" className="text-sm font-semibold text-jjs-preto">
            Categoria
          </label>
          <select
            id="cat-cat"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as Categoria | '')}
            className="min-h-toque rounded-campo border border-jjs-borda bg-jjs-branco px-3"
          >
            <option value="">Sem categoria</option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-jjs-preto">Valor sugerido</label>
        <CampoDinheiro valorCentavos={valor} aoMudar={setValor} aria-label="Valor sugerido" />
        <p className="text-sm text-jjs-texto-fraco">
          Deixe zerado para &quot;a combinar&quot; — é o normal para peça, que muda de preço.
        </p>
      </div>

      <div className="flex justify-end gap-3">
        <Botao variante="secundario" onClick={aoCancelar}>
          Cancelar
        </Botao>
        <Botao type="submit" variante="principal" disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar'}
        </Botao>
      </div>
    </form>
  );
}
