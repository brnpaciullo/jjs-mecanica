import { useEffect, useState } from 'react';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { ROTULO_TIPO_ITEM, formatarDinheiro, totalItem, type TipoItem } from '@jjs/core';
import type { CatalogoRegistro, ItemRegistro } from '@jjs/db';
import { Botao, cn } from '@jjs/ui';
import { CampoDinheiro } from './CampoDinheiro.js';

export interface TabelaItensProps {
  ordemId: number;
  itens: ItemRegistro[];
  aoMudar: () => void;
  aoErro: (mensagem: string) => void;
}

/**
 * Itens da OS, separados em Peças e Mão de obra.
 *
 * Cada célula salva sozinha ao sair do campo — quem está no balcão com o
 * cliente na frente não pode depender de lembrar de um botão Salvar.
 * O checkbox "aprovado" é o que sustenta a aprovação parcial: desmarcar
 * derruba o total na hora.
 */
export function TabelaItens({ ordemId, itens, aoMudar, aoErro }: TabelaItensProps) {
  const grupos: TipoItem[] = ['peca', 'mao_de_obra'];

  return (
    <div className="flex flex-col gap-6">
      {grupos.map((tipo) => (
        <GrupoItens
          key={tipo}
          tipo={tipo}
          ordemId={ordemId}
          itens={itens.filter((i) => i.tipo === tipo)}
          aoMudar={aoMudar}
          aoErro={aoErro}
        />
      ))}
    </div>
  );
}

function GrupoItens({
  tipo,
  ordemId,
  itens,
  aoMudar,
  aoErro,
}: {
  tipo: TipoItem;
  ordemId: number;
  itens: ItemRegistro[];
  aoMudar: () => void;
  aoErro: (m: string) => void;
}) {
  const [arrastando, setArrastando] = useState<number | null>(null);

  async function soltar(alvoId: number) {
    if (arrastando === null || arrastando === alvoId) return;
    const ids = itens.map((i) => i.id);
    const de = ids.indexOf(arrastando);
    const para = ids.indexOf(alvoId);
    if (de < 0 || para < 0) return;

    ids.splice(para, 0, ...ids.splice(de, 1));
    setArrastando(null);
    try {
      await window.jjs.itens.reordenar(ordemId, ids);
      aoMudar();
    } catch (causa) {
      aoErro(String(causa));
    }
  }

  const subtotal = itens.filter((i) => i.aprovado).reduce((soma, i) => soma + totalItem(i), 0);

  return (
    <section>
      <header className="mb-2 flex items-center justify-between">
        <h3 className="font-titulo text-xl text-jjs-preto">{ROTULO_TIPO_ITEM[tipo]}</h3>
        <span className="tabular-nums text-jjs-texto-fraco">{formatarDinheiro(subtotal)}</span>
      </header>

      <div className="overflow-hidden rounded-card border border-jjs-borda bg-jjs-branco">
        {itens.length === 0 ? (
          <p className="px-4 py-4 text-jjs-texto-fraco">
            Nenhum item de {ROTULO_TIPO_ITEM[tipo].toLowerCase()} ainda.
          </p>
        ) : (
          <ul className="divide-y divide-jjs-borda">
            {itens.map((item) => (
              <LinhaItem
                /* Chave por conteúdo: quando o item muda por fora (reordenar,
                   marcar todos), a linha reinicia com os valores novos. Evita
                   um efeito sincronizando prop com state, e não atrapalha a
                   digitação porque o salvamento só acontece ao sair do campo. */
                key={`${item.id}:${item.descricao}:${item.quantidade}:${item.valorUnitarioCentavos}:${item.observacao ?? ''}:${item.posicao}`}
                item={item}
                arrastando={arrastando === item.id}
                aoArrastar={() => setArrastando(item.id)}
                aoSoltar={() => void soltar(item.id)}
                aoMudar={aoMudar}
                aoErro={aoErro}
              />
            ))}
          </ul>
        )}

        <div className="border-t border-jjs-borda p-3">
          <NovoItem tipo={tipo} ordemId={ordemId} aoMudar={aoMudar} aoErro={aoErro} />
        </div>
      </div>
    </section>
  );
}

function LinhaItem({
  item,
  arrastando,
  aoArrastar,
  aoSoltar,
  aoMudar,
  aoErro,
}: {
  item: ItemRegistro;
  arrastando: boolean;
  aoArrastar: () => void;
  aoSoltar: () => void;
  aoMudar: () => void;
  aoErro: (m: string) => void;
}) {
  const [descricao, setDescricao] = useState(item.descricao);
  const [quantidade, setQuantidade] = useState(String(item.quantidade));
  const [valor, setValor] = useState(item.valorUnitarioCentavos);
  const [observacao, setObservacao] = useState(item.observacao ?? '');

  async function salvar(mudancas: Parameters<typeof window.jjs.itens.atualizar>[0]) {
    try {
      await window.jjs.itens.atualizar(mudancas);
      aoMudar();
    } catch (causa) {
      aoErro(String(causa));
    }
  }

  async function remover() {
    try {
      await window.jjs.itens.remover(item.id);
      aoMudar();
    } catch (causa) {
      aoErro(String(causa));
    }
  }

  const qtd = Number(quantidade.replace(',', '.')) || 0;

  return (
    <li
      draggable
      onDragStart={aoArrastar}
      onDragOver={(e) => e.preventDefault()}
      onDrop={aoSoltar}
      className={cn(
        'flex flex-wrap items-center gap-2 px-3 py-2',
        arrastando && 'opacity-50',
        !item.aprovado && 'bg-jjs-papel',
      )}
    >
      <span className="cursor-grab text-jjs-texto-fraco" aria-hidden="true">
        <GripVertical size={18} />
      </span>

      <input
        type="checkbox"
        checked={item.aprovado}
        onChange={(e) => void salvar({ id: item.id, aprovado: e.target.checked })}
        className="size-5 shrink-0"
        aria-label={`Incluir ${item.descricao} no orçamento`}
        title="Incluir no orçamento"
      />

      <div className="flex min-w-48 flex-1 flex-col gap-1">
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          onBlur={() => descricao !== item.descricao && void salvar({ id: item.id, descricao })}
          aria-label="Descrição do item"
          className={cn(
            'min-h-10 rounded-campo border border-transparent bg-transparent px-2 font-medium',
            'hover:border-jjs-borda focus:border-jjs-borda focus:bg-jjs-branco',
            !item.aprovado && 'line-through decoration-jjs-texto-fraco',
          )}
        />
        <input
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          onBlur={() =>
            observacao !== (item.observacao ?? '') && void salvar({ id: item.id, observacao })
          }
          placeholder="Observação (aparece no orçamento)"
          aria-label="Observação do item"
          className="min-h-9 rounded-campo border border-transparent bg-transparent px-2 text-sm text-jjs-texto-fraco hover:border-jjs-borda focus:border-jjs-borda focus:bg-jjs-branco"
        />
      </div>

      <input
        value={quantidade}
        onChange={(e) => setQuantidade(e.target.value)}
        onBlur={() =>
          qtd > 0 && qtd !== item.quantidade && void salvar({ id: item.id, quantidade: qtd })
        }
        inputMode="decimal"
        aria-label="Quantidade"
        className="min-h-10 w-16 rounded-campo border border-jjs-borda px-2 text-center tabular-nums"
      />

      <div className="w-36">
        <CampoDinheiro
          valorCentavos={valor}
          aoMudar={setValor}
          aoSairDoCampo={() =>
            valor !== item.valorUnitarioCentavos &&
            void salvar({ id: item.id, valorUnitarioCentavos: valor })
          }
          aria-label="Valor unitário"
          className="min-h-10"
        />
      </div>

      <span className="w-28 text-right font-semibold tabular-nums">
        {formatarDinheiro(totalItem({ quantidade: qtd, valorUnitarioCentavos: valor }))}
      </span>

      <Botao
        variante="discreto"
        className="min-h-10 px-2 text-jjs-vermelho"
        aria-label={`Remover ${item.descricao}`}
        onClick={() => void remover()}
      >
        <Trash2 size={18} />
      </Botao>
    </li>
  );
}

/** Linha de adicionar, com autocompletar do catálogo. */
function NovoItem({
  tipo,
  ordemId,
  aoMudar,
  aoErro,
}: {
  tipo: TipoItem;
  ordemId: number;
  aoMudar: () => void;
  aoErro: (m: string) => void;
}) {
  const [descricao, setDescricao] = useState('');
  const [sugestoes, setSugestoes] = useState<CatalogoRegistro[]>([]);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (descricao.trim().length < 2) return;
    let valendo = true;
    const timer = setTimeout(() => {
      window.jjs.catalogo.sugerir(descricao).then((lista) => {
        if (!valendo) return;
        // O catálogo do grupo certo vem primeiro, mas sem esconder o resto:
        // "óleo de câmbio" é peça e pode ser lançado na linha de mão de obra.
        setSugestoes([...lista].sort((a, b) => Number(b.tipo === tipo) - Number(a.tipo === tipo)));
        setAberto(true);
      });
    }, 180);
    return () => {
      valendo = false;
      clearTimeout(timer);
    };
  }, [descricao, tipo]);

  async function adicionar(doCatalogo?: CatalogoRegistro) {
    const texto = doCatalogo?.descricao ?? descricao.trim();
    if (!texto) return;

    try {
      await window.jjs.itens.adicionar({
        ordemId,
        tipo: doCatalogo?.tipo ?? tipo,
        descricao: texto,
        quantidade: 1,
        valorUnitarioCentavos: doCatalogo?.valorPadraoCentavos ?? 0,
        aprovado: true,
      });
      setDescricao('');
      setSugestoes([]);
      setAberto(false);
      aoMudar();
    } catch (causa) {
      aoErro(String(causa));
    }
  }

  // Termo curto não mostra nada, sem precisar limpar a lista num efeito.
  const mostrarSugestoes = descricao.trim().length >= 2 ? sugestoes : [];

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          onFocus={() => mostrarSugestoes.length > 0 && setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void adicionar(
                mostrarSugestoes[0]?.descricao === descricao ? mostrarSugestoes[0] : undefined,
              );
            }
            if (e.key === 'Escape') setAberto(false);
          }}
          placeholder={`Adicionar ${ROTULO_TIPO_ITEM[tipo].toLowerCase()} — digite para buscar no catálogo`}
          aria-label={`Adicionar ${ROTULO_TIPO_ITEM[tipo]}`}
          className="min-h-toque flex-1 rounded-campo border border-jjs-borda px-3"
        />
        <Botao variante="secundario" icone={<Plus size={18} />} onClick={() => void adicionar()}>
          Adicionar
        </Botao>
      </div>

      {aberto && mostrarSugestoes.length > 0 ? (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-card border border-jjs-borda bg-jjs-branco shadow-lg">
          {mostrarSugestoes.map((sugestao) => (
            <li key={sugestao.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void adicionar(sugestao)}
                className="flex min-h-toque w-full items-center gap-3 px-3 py-2 text-left hover:bg-jjs-papel"
              >
                <span className="flex-1">{sugestao.descricao}</span>
                <span className="text-sm text-jjs-texto-fraco">
                  {ROTULO_TIPO_ITEM[sugestao.tipo]}
                </span>
                <span className="tabular-nums">
                  {sugestao.valorPadraoCentavos === null
                    ? 'a combinar'
                    : formatarDinheiro(sugestao.valorPadraoCentavos)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
