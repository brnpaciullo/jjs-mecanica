import { useState } from 'react';
import { LifeBuoy } from 'lucide-react';
import { Botao } from '@jjs/ui';
import { Aviso } from './Aviso.js';
import { mensagemDeErro } from '../erro.js';

/** Pacote de suporte, sem nenhum dado de cliente dentro. */
export function CartaoDiagnostico() {
  const [ocupado, setOcupado] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);
  const [falha, setFalha] = useState<string | null>(null);

  async function exportar() {
    setOcupado(true);
    setFalha(null);
    setRecado(null);
    try {
      const caminho = await window.jjs.diagnostico.exportar();
      if (caminho) setRecado(`Arquivo salvo em ${caminho}`);
    } catch (causa) {
      setFalha(mensagemDeErro(causa));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="rounded-card border border-jjs-borda bg-jjs-branco p-5">
      <h2 className="font-titulo text-2xl text-jjs-preto">Deu algum problema?</h2>
      <p className="mt-1 text-jjs-texto-fraco">
        Gere o arquivo de diagnóstico e mande para quem cuida do sistema. Ele leva só os registros
        de funcionamento — <strong>nenhum dado de cliente</strong>, nenhuma foto, nenhuma conversa.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {falha ? <Aviso tom="erro">{falha}</Aviso> : null}
        {recado ? <Aviso tom="ok">{recado}</Aviso> : null}

        <div>
          <Botao
            variante="secundario"
            icone={<LifeBuoy size={18} />}
            disabled={ocupado}
            onClick={() => void exportar()}
          >
            {ocupado ? 'Gerando...' : 'Gerar diagnóstico'}
          </Botao>
        </div>
      </div>
    </section>
  );
}
