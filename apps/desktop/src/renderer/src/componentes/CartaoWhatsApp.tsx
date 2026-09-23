import { useState } from 'react';
import { Loader2, MessageCircle, QrCode, Send, Unplug } from 'lucide-react';
import { formatarTelefone, mascararTelefone } from '@jjs/core';
import { Botao, Campo } from '@jjs/ui';
import { useWhatsApp } from '../hooks/useWhatsApp.js';
import { Aviso } from './Aviso.js';
import { Confirmacao } from './Confirmacao.js';
import { mensagemDeErro } from '../erro.js';

/** Configurações > WhatsApp: conectar, conferir e desconectar. */
export function CartaoWhatsApp() {
  const estado = useWhatsApp();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [telefoneTeste, setTelefoneTeste] = useState('');
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  async function executar(acao: () => Promise<unknown>, aviso?: string) {
    setOcupado(true);
    setErro(null);
    setRecado(null);
    try {
      await acao();
      if (aviso) setRecado(aviso);
    } catch (causa) {
      setErro(mensagemDeErro(causa));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="rounded-card border border-jjs-borda bg-jjs-branco p-5">
      <h2 className="font-titulo text-2xl text-jjs-preto">WhatsApp</h2>
      <p className="mt-1 text-jjs-texto-fraco">
        É por aqui que o orçamento chega ao cliente. Use o número da oficina, não o seu pessoal.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
        {recado ? <Aviso tom="ok">{recado}</Aviso> : null}
        {estado.aviso ? <Aviso tom="info">{estado.aviso}</Aviso> : null}

        {estado.situacao === 'conectado' ? (
          <>
            <div className="flex items-center gap-3 rounded-card border border-jjs-verde bg-jjs-verde/10 p-4">
              <MessageCircle size={28} className="text-jjs-verde" aria-hidden="true" />
              <div>
                <p className="font-semibold">Conectado</p>
                <p className="tabular-nums text-jjs-texto-fraco">
                  {estado.numero ? formatarTelefone(estado.numero) : ''}
                  {estado.nome ? ` · ${estado.nome}` : ''}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1">
                <Campo
                  rotulo="Mandar uma mensagem de teste para"
                  value={telefoneTeste}
                  onChange={(e) => setTelefoneTeste(mascararTelefone(e.target.value))}
                  placeholder="(41) 99999-9999"
                  inputMode="tel"
                />
              </div>
              <Botao
                variante="secundario"
                icone={<Send size={18} />}
                disabled={ocupado || telefoneTeste.length < 10}
                onClick={() =>
                  void executar(
                    () => window.jjs.whatsapp.teste(telefoneTeste),
                    'Mensagem de teste enviada. Confira no celular.',
                  )
                }
              >
                Enviar teste
              </Botao>
            </div>

            <div>
              <Botao
                variante="perigo"
                icone={<Unplug size={18} />}
                disabled={ocupado}
                onClick={() => setConfirmandoSaida(true)}
              >
                Desconectar
              </Botao>
            </div>
          </>
        ) : null}

        {estado.situacao === 'lendo_qr' && estado.qrDataUri ? (
          <div className="flex flex-wrap items-center gap-6">
            <img
              src={estado.qrDataUri}
              alt="QR code para conectar o WhatsApp"
              className="size-64 rounded-card border border-jjs-borda bg-white p-2"
            />
            <ol className="flex max-w-sm list-decimal flex-col gap-2 pl-5 text-lg">
              <li>Abra o WhatsApp no celular da oficina.</li>
              <li>
                Toque nos três pontinhos e depois em <strong>Aparelhos conectados</strong>.
              </li>
              <li>
                Toque em <strong>Conectar um aparelho</strong>.
              </li>
              <li>Aponte a câmera para este QR code.</li>
            </ol>
          </div>
        ) : null}

        {estado.situacao === 'conectando' ? (
          <p className="flex items-center gap-2 text-jjs-texto-fraco">
            <Loader2 size={20} className="animate-spin" />
            Conectando... o QR code aparece em alguns segundos.
          </p>
        ) : null}

        {estado.situacao === 'desconectado' ? (
          <div>
            <Botao
              variante="principal"
              tamanho="grande"
              icone={<QrCode size={22} />}
              disabled={ocupado}
              onClick={() => void executar(() => window.jjs.whatsapp.conectar())}
            >
              Conectar o WhatsApp
            </Botao>
          </div>
        ) : null}
      </div>

      <Confirmacao
        aberto={confirmandoSaida}
        titulo="Desconectar o WhatsApp?"
        mensagem="O sistema vai parar de enviar orçamento e aviso de pronto. Para voltar a usar, será preciso ler o QR code de novo no celular da oficina."
        rotuloConfirmar="Desconectar"
        perigo
        aoConfirmar={() => {
          setConfirmandoSaida(false);
          void executar(() => window.jjs.whatsapp.desconectar());
        }}
        aoCancelar={() => setConfirmandoSaida(false)}
      />
    </section>
  );
}
