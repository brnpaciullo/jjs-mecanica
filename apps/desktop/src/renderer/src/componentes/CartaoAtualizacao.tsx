import { useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { Botao } from '@jjs/ui';
import { Aviso } from './Aviso.js';
import { useAtualizacao } from '../hooks/useAtualizacao.js';
import { mensagemDeErro } from '../erro.js';

/**
 * Atualização do sistema.
 *
 * O download é automático, mas **instalar é sempre escolha de quem está no
 * balcão**: trocar o programa no meio de um atendimento fecharia a tela com o
 * cliente na frente.
 */
export function CartaoAtualizacao() {
  const estado = useAtualizacao();
  const [ocupado, setOcupado] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);

  async function executar(acao: () => Promise<unknown>) {
    setOcupado(true);
    setFalha(null);
    try {
      await acao();
    } catch (causa) {
      setFalha(mensagemDeErro(causa));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="rounded-card border border-jjs-borda bg-jjs-branco p-5">
      <h2 className="font-titulo text-2xl text-jjs-preto">Atualização do sistema</h2>

      <div className="mt-4 flex flex-col gap-4">
        {falha ? <Aviso tom="erro">{falha}</Aviso> : null}
        {estado.aviso ? <Aviso tom="info">{estado.aviso}</Aviso> : null}

        {estado.situacao === 'pronta' ? (
          <div className="rounded-card border border-jjs-verde bg-jjs-verde/10 p-4">
            <p className="font-titulo text-xl">Versão {estado.versaoNova} pronta para instalar</p>
            <p className="mt-1 text-jjs-texto-fraco">
              O sistema fecha, atualiza e abre de novo — leva menos de um minuto. Antes disso ele
              faz um backup sozinho. Escolha uma hora sem cliente no balcão.
            </p>
            <div className="mt-3">
              <Botao
                variante="principal"
                tamanho="grande"
                icone={<Download size={20} />}
                disabled={ocupado}
                onClick={() => void executar(() => window.jjs.atualizacao.aplicar())}
              >
                Instalar e reiniciar agora
              </Botao>
            </div>
          </div>
        ) : null}

        {estado.situacao === 'baixando' ? (
          <div>
            <p>
              Baixando a versão {estado.versaoNova}... {estado.progresso}%
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-jjs-papel">
              <div
                className="h-full bg-jjs-amarelo transition-[width]"
                style={{ width: `${estado.progresso}%` }}
              />
            </div>
            <p className="mt-1 text-sm text-jjs-texto-fraco">
              Pode continuar usando normalmente. Aviso quando terminar.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-4">
          <span className="text-jjs-texto-fraco">
            Versão instalada: <strong className="text-jjs-preto">{estado.versaoInstalada}</strong>
            {estado.situacao === 'em_dia' ? ' · está em dia' : ''}
          </span>

          <Botao
            variante="secundario"
            icone={<RefreshCw size={18} />}
            disabled={ocupado || estado.situacao === 'procurando'}
            onClick={() => void executar(() => window.jjs.atualizacao.procurar())}
          >
            {estado.situacao === 'procurando' ? 'Procurando...' : 'Procurar atualizações'}
          </Botao>
        </div>
      </div>
    </section>
  );
}
