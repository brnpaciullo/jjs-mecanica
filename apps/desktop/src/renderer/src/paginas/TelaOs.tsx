import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Download, MessageCircle, Printer } from 'lucide-react';
import {
  ROTULO_STATUS,
  STATUS_ORDEM,
  ehVoltarStatus,
  estaVencido,
  formatarData,
  formatarDataHora,
  formatarDinheiro,
  formatarNumeroOs,
  formatarTelefone,
  proximoStatus,
  type StatusOrdem,
} from '@jjs/core';
import type { OrdemCompleta } from '../../../preload/index.js';
import { Botao, Placa } from '@jjs/ui';
import { Pagina } from '../componentes/Pagina.js';
import { Aviso } from '../componentes/Aviso.js';
import { Confirmacao } from '../componentes/Confirmacao.js';
import { DialogoEntrega } from '../componentes/DialogoEntrega.js';
import { DialogoImpressao } from '../componentes/DialogoImpressao.js';
import { EtiquetaStatus } from '../componentes/EtiquetaStatus.js';
import { IndicadorSalvo } from '../componentes/IndicadorSalvo.js';
import { CampoDinheiro } from '../componentes/CampoDinheiro.js';
import { TabelaItens } from '../componentes/TabelaItens.js';
import { GaleriaDeMidias } from '../componentes/GaleriaDeMidias.js';
import { useConsulta } from '../hooks/useConsulta.js';
import { useWhatsApp } from '../hooks/useWhatsApp.js';
import { useSalvamentoAutomatico } from '../hooks/useSalvamentoAutomatico.js';
import { mensagemDeErro } from '../erro.js';

/**
 * A tela mais importante do sistema: uma página só, em seções.
 * Tudo que é digitado aqui salva sozinho.
 */
export function TelaOs() {
  const { id } = useParams();
  const ordemId = Number(id);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [statusPendente, setStatusPendente] = useState<StatusOrdem | null>(null);
  const [entregando, setEntregando] = useState(false);
  const [imprimindo, setImprimindo] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);
  const whatsapp = useWhatsApp();

  const consulta = useConsulta<OrdemCompleta | null>(
    () => window.jjs.ordens.abrir(ordemId),
    [ordemId],
  );

  if (consulta.erro) {
    return (
      <Pagina titulo="OS">
        <Aviso tom="erro">{consulta.erro}</Aviso>
      </Pagina>
    );
  }

  if (!consulta.dados) {
    return (
      <Pagina titulo="OS">
        <p className="text-jjs-texto-fraco">
          {consulta.carregando ? 'Carregando...' : 'Essa OS não foi encontrada.'}
        </p>
      </Pagina>
    );
  }

  const { ordem, detalhe, itens, totais, eventos } = consulta.dados;

  async function mudarStatus(novo: StatusOrdem) {
    try {
      await window.jjs.ordens.mudarStatus({ id: ordemId, status: novo });
      setErroAcao(null);
      consulta.recarregar();
    } catch (causa) {
      setErroAcao(mensagemDeErro(causa));
    }
  }

  function pedirMudancaDeStatus(novo: StatusOrdem) {
    // Voltar no fluxo pede confirmação; avançar não atrapalha o balcão.
    if (ehVoltarStatus(ordem.status, novo)) {
      setStatusPendente(novo);
      return;
    }
    // Entregar é o momento de fechar a conta: pergunta pagamento e km de saída.
    if (novo === 'entregue') {
      setEntregando(true);
      return;
    }
    void mudarStatus(novo);
  }

  /** Gera o PDF e abre a pasta com ele já selecionado, pronto para arrastar. */
  async function baixarPdf() {
    setBaixando(true);
    try {
      await window.jjs.pdf.gerarEAbrir({ id: ordemId });
      setErroAcao(null);
    } catch (causa) {
      setErroAcao(mensagemDeErro(causa));
    } finally {
      setBaixando(false);
    }
  }

  /**
   * Envia pelo WhatsApp. Não bloqueia quando está desconectado: o próprio
   * envio cai no plano B (WhatsApp Web + pasta do PDF) e conta o que fez.
   */
  async function enviarNoWhatsApp() {
    setEnviando(true);
    setRecado(null);
    try {
      const r =
        ordem.status === 'pronto'
          ? await window.jjs.whatsapp.avisarPronto(ordemId)
          : await window.jjs.whatsapp.enviarOrcamento(ordemId);
      setRecado(r.mensagem);
      setErroAcao(null);
      consulta.recarregar();
    } catch (causa) {
      setErroAcao(mensagemDeErro(causa));
    } finally {
      setEnviando(false);
    }
  }

  // Antes da aprovação o documento é "Orçamento"; depois vira "Ordem de Serviço".
  const documento = ['aprovado', 'em_servico', 'pronto', 'entregue'].includes(ordem.status)
    ? 'Ordem de Serviço'
    : 'Orçamento';

  const seguinte = proximoStatus(ordem.status);
  const vencido = estaVencido(ordem.validadeAte);

  return (
    <Pagina
      titulo={formatarNumeroOs(ordem.numero)}
      acoes={
        <div className="flex items-center gap-3">
          <EtiquetaStatus status={ordem.status} />
          <select
            value={ordem.status}
            onChange={(e) => pedirMudancaDeStatus(e.target.value as StatusOrdem)}
            aria-label="Mudar situação da OS"
            className="min-h-toque rounded-campo border border-jjs-borda bg-jjs-branco px-3"
          >
            {STATUS_ORDEM.map((s) => (
              <option key={s} value={s}>
                {ROTULO_STATUS[s]}
              </option>
            ))}
          </select>
        </div>
      }
    >
      {erroAcao ? <Aviso tom="erro">{erroAcao}</Aviso> : null}
      {recado ? <Aviso tom="ok">{recado}</Aviso> : null}

      {/* Cabeçalho: carro, cliente, telefone */}
      <section className="flex flex-wrap items-center gap-6 rounded-card border border-jjs-borda bg-jjs-branco p-5">
        {detalhe ? <Placa placa={detalhe.placa} tamanho="grande" /> : null}
        <div className="flex-1">
          <p className="font-titulo text-2xl text-jjs-preto">
            {detalhe?.marca} {detalhe?.modelo}
          </p>
          <p className="text-jjs-texto-fraco">
            <Link
              to={`/clientes/${ordem.clienteId}`}
              className="underline-offset-2 hover:underline"
            >
              {detalhe?.clienteNome}
            </Link>
            {' · '}
            {detalhe ? formatarTelefone(detalhe.clienteTelefone) : ''}
          </p>
          <p className="mt-1 text-sm text-jjs-texto-fraco">
            Aberta em {formatarData(ordem.criadoEm)}
            {ordem.kmEntrada ? ` · ${ordem.kmEntrada.toLocaleString('pt-BR')} km na entrada` : ''}
            {ordem.combustivel ? ` · tanque ${ordem.combustivel}` : ''}
          </p>
        </div>
        <Link
          to={`/veiculos/${ordem.veiculoId}`}
          className="rounded-campo border border-jjs-borda px-4 py-2 hover:bg-jjs-papel"
        >
          Histórico do carro
        </Link>
      </section>

      {vencido && ordem.status === 'orcamento_enviado' ? (
        <Aviso tom="info">
          Esse orçamento passou da validade ({formatarData(ordem.validadeAte!)}). Confirme os
          valores com o cliente antes de começar o serviço.
        </Aviso>
      ) : null}

      <QueixasEDiagnostico ordem={ordem} aoSalvar={consulta.recarregar} />

      {/* Itens */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-titulo text-2xl text-jjs-preto">Itens do orçamento</h2>
          {itens.length > 0 ? (
            <div className="flex gap-2">
              <Botao
                variante="secundario"
                className="min-h-10"
                onClick={() =>
                  window.jjs.itens.aprovarTodos(ordemId, true).then(consulta.recarregar)
                }
              >
                Marcar todos
              </Botao>
              <Botao
                variante="secundario"
                className="min-h-10"
                onClick={() =>
                  window.jjs.itens.aprovarTodos(ordemId, false).then(consulta.recarregar)
                }
              >
                Desmarcar todos
              </Botao>
            </div>
          ) : null}
        </div>

        <TabelaItens
          ordemId={ordemId}
          itens={itens}
          aoMudar={consulta.recarregar}
          aoErro={(m) => setErroAcao(mensagemDeErro(m))}
        />
      </section>

      <Resumo ordem={ordem} totais={totais} aoSalvar={consulta.recarregar} />

      <GaleriaDeMidias ordemId={ordemId} />

      <LinhaDoTempo eventos={eventos} />

      {/* Barra de ações fixa no rodapé */}
      <div className="sticky bottom-0 -mx-8 mt-4 flex flex-wrap items-center gap-3 border-t border-jjs-borda bg-jjs-branco px-8 py-3">
        <span className="font-titulo text-2xl">
          Total: {formatarDinheiro(totais.totalCentavos)}
        </span>

        <div className="ml-auto flex flex-wrap gap-3">
          <Botao
            variante="secundario"
            icone={<Printer size={18} />}
            onClick={() => setImprimindo(true)}
          >
            Imprimir
          </Botao>
          <Botao
            variante="secundario"
            icone={<Download size={18} />}
            onClick={() => void baixarPdf()}
            disabled={baixando}
          >
            {baixando ? 'Gerando...' : 'Baixar PDF'}
          </Botao>
          <Botao
            variante={ordem.status === 'pronto' ? 'principal' : 'secundario'}
            icone={<MessageCircle size={18} />}
            onClick={() => void enviarNoWhatsApp()}
            disabled={enviando}
            title={
              whatsapp.situacao === 'conectado'
                ? undefined
                : 'O WhatsApp está desconectado — vai abrir o WhatsApp Web com a mensagem pronta.'
            }
          >
            {enviando
              ? 'Enviando...'
              : ordem.status === 'pronto'
                ? 'Avisar cliente no WhatsApp'
                : 'Enviar no WhatsApp'}
          </Botao>
          {seguinte ? (
            <Botao
              variante="principal"
              icone={<CheckCircle2 size={18} />}
              onClick={() => pedirMudancaDeStatus(seguinte)}
            >
              {seguinte === 'aprovado' ? 'Marcar como aprovado' : ROTULO_STATUS[seguinte]}
            </Botao>
          ) : null}
        </div>
      </div>

      <DialogoImpressao
        aberto={imprimindo}
        ordemId={ordemId}
        titulo={documento}
        aoFechar={() => setImprimindo(false)}
      />

      <DialogoEntrega
        aberto={entregando}
        ordemId={ordemId}
        totalCentavos={totais.totalCentavos}
        kmEntrada={ordem.kmEntrada}
        formaPagamentoAtual={ordem.formaPagamento}
        aoCancelar={() => setEntregando(false)}
        aoEntregar={() => {
          setEntregando(false);
          consulta.recarregar();
        }}
      />

      <Confirmacao
        aberto={statusPendente !== null}
        titulo="Voltar a situação da OS?"
        mensagem={
          statusPendente
            ? `A OS vai voltar de "${ROTULO_STATUS[ordem.status]}" para "${ROTULO_STATUS[statusPendente]}". Isso fica registrado na linha do tempo. Os itens e valores não mudam.`
            : ''
        }
        rotuloConfirmar="Voltar mesmo assim"
        aoConfirmar={() => {
          const novo = statusPendente;
          setStatusPendente(null);
          if (novo) void mudarStatus(novo);
        }}
        aoCancelar={() => setStatusPendente(null)}
      />
    </Pagina>
  );
}

function QueixasEDiagnostico({
  ordem,
  aoSalvar,
}: {
  ordem: OrdemCompleta['ordem'];
  aoSalvar: () => void;
}) {
  const [queixas, setQueixas] = useState(ordem.queixas);
  const [diagnostico, setDiagnostico] = useState(ordem.diagnostico ?? '');

  const salvarQueixas = useSalvamentoAutomatico(async (texto: string) => {
    await window.jjs.ordens.atualizar({ id: ordem.id, queixas: texto });
    aoSalvar();
  });

  const salvarDiagnostico = useSalvamentoAutomatico(async (texto: string) => {
    await window.jjs.ordens.atualizar({ id: ordem.id, diagnostico: texto });
    aoSalvar();
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-card border border-jjs-borda bg-jjs-branco p-5">
        <header className="mb-2 flex items-center justify-between">
          <h2 className="font-titulo text-2xl text-jjs-preto">O que o cliente falou</h2>
          <IndicadorSalvo estado={salvarQueixas.estado} erro={salvarQueixas.erro} />
        </header>
        <textarea
          value={queixas}
          onChange={(e) => {
            setQueixas(e.target.value);
            salvarQueixas.agendar(e.target.value);
          }}
          onBlur={salvarQueixas.agora}
          rows={5}
          aria-label="Queixas do cliente"
          className="w-full rounded-campo border border-jjs-borda p-3"
        />
      </section>

      <section className="rounded-card border border-jjs-borda bg-jjs-branco p-5">
        <header className="mb-2 flex items-center justify-between">
          <h2 className="font-titulo text-2xl text-jjs-preto">O que a oficina constatou</h2>
          <IndicadorSalvo estado={salvarDiagnostico.estado} erro={salvarDiagnostico.erro} />
        </header>
        <textarea
          value={diagnostico}
          onChange={(e) => {
            setDiagnostico(e.target.value);
            salvarDiagnostico.agendar(e.target.value);
          }}
          onBlur={salvarDiagnostico.agora}
          rows={5}
          placeholder="O diagnóstico técnico. É o que justifica os itens do orçamento."
          aria-label="Diagnóstico da oficina"
          className="w-full rounded-campo border border-jjs-borda p-3"
        />
      </section>
    </div>
  );
}

function Resumo({
  ordem,
  totais,
  aoSalvar,
}: {
  ordem: OrdemCompleta['ordem'];
  totais: OrdemCompleta['totais'];
  aoSalvar: () => void;
}) {
  const [desconto, setDesconto] = useState(ordem.descontoCentavos);
  const [prazo, setPrazo] = useState(ordem.prazoEstimado ?? '');
  const [pagamento, setPagamento] = useState(ordem.formaPagamento ?? '');

  async function salvar(mudancas: Parameters<typeof window.jjs.ordens.atualizar>[0]) {
    await window.jjs.ordens.atualizar(mudancas);
    aoSalvar();
  }

  return (
    <section className="rounded-card border border-jjs-borda bg-jjs-branco p-5">
      <h2 className="mb-4 font-titulo text-2xl text-jjs-preto">Resumo</h2>

      <div className="grid gap-6 lg:grid-cols-2">
        <dl className="flex flex-col gap-2">
          <div className="flex justify-between">
            <dt className="text-jjs-texto-fraco">Peças</dt>
            <dd className="tabular-nums">{formatarDinheiro(totais.subtotalPecasCentavos)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-jjs-texto-fraco">Mão de obra</dt>
            <dd className="tabular-nums">{formatarDinheiro(totais.subtotalMaoDeObraCentavos)}</dd>
          </div>
          <div className="flex justify-between border-t border-jjs-borda pt-2">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{formatarDinheiro(totais.subtotalCentavos)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-jjs-texto-fraco">Desconto</dt>
            <dd className="w-40">
              <CampoDinheiro
                valorCentavos={desconto}
                aoMudar={setDesconto}
                aoSairDoCampo={() =>
                  desconto !== ordem.descontoCentavos &&
                  void salvar({ id: ordem.id, descontoCentavos: desconto })
                }
                aria-label="Desconto"
              />
            </dd>
          </div>
          <div className="flex justify-between border-t-2 border-jjs-preto pt-2">
            <dt className="font-titulo text-2xl">TOTAL</dt>
            <dd className="font-titulo text-2xl tabular-nums">
              {formatarDinheiro(totais.totalCentavos)}
            </dd>
          </div>
          {totais.itensNaoAprovados > 0 ? (
            <p className="text-sm text-jjs-texto-fraco">
              {totais.itensNaoAprovados} item(ns) fora do orçamento não entram nesse total.
            </p>
          ) : null}
        </dl>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="prazo" className="text-sm font-semibold">
              Prazo estimado
            </label>
            <input
              id="prazo"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              onBlur={() =>
                prazo !== (ordem.prazoEstimado ?? '') &&
                void salvar({ id: ordem.id, prazoEstimado: prazo })
              }
              placeholder="2 dias úteis"
              className="min-h-toque rounded-campo border border-jjs-borda px-3"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="pagamento" className="text-sm font-semibold">
              Forma de pagamento
            </label>
            <input
              id="pagamento"
              value={pagamento}
              onChange={(e) => setPagamento(e.target.value)}
              onBlur={() =>
                pagamento !== (ordem.formaPagamento ?? '') &&
                void salvar({ id: ordem.id, formaPagamento: pagamento })
              }
              placeholder="Pix, cartão em 3x, dinheiro"
              className="min-h-toque rounded-campo border border-jjs-borda px-3"
            />
          </div>

          {ordem.validadeAte ? (
            <p className="text-sm text-jjs-texto-fraco">
              Orçamento válido até {formatarData(ordem.validadeAte)}.
            </p>
          ) : null}

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={ordem.pago}
              onChange={(e) => void salvar({ id: ordem.id, pago: e.target.checked })}
              className="size-5"
            />
            <span>Já foi pago</span>
          </label>
        </div>
      </div>
    </section>
  );
}

function LinhaDoTempo({ eventos }: { eventos: OrdemCompleta['eventos'] }) {
  if (eventos.length === 0) return null;

  return (
    <section className="rounded-card border border-jjs-borda bg-jjs-branco p-5">
      <h2 className="mb-3 font-titulo text-2xl text-jjs-preto">Linha do tempo</h2>
      <ol className="flex flex-col gap-2">
        {eventos.map((evento) => (
          <li key={evento.id} className="flex flex-wrap items-baseline gap-2 text-sm">
            <span className="tabular-nums text-jjs-texto-fraco">
              {formatarDataHora(evento.criadoEm)}
            </span>
            <span className="text-jjs-preto">{evento.descricao}</span>
            {evento.usuarioNome ? (
              <span className="text-jjs-texto-fraco">· {evento.usuarioNome}</span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
