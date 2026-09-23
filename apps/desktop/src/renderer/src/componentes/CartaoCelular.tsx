import { useEffect, useState } from 'react';
import { Check, QrCode, ShieldAlert, Smartphone, X } from 'lucide-react';
import { formatarDataHora } from '@jjs/core';
import { Botao } from '@jjs/ui';
import { Aviso } from './Aviso.js';
import { Confirmacao } from './Confirmacao.js';
import { useConsulta } from '../hooks/useConsulta.js';
import { mensagemDeErro } from '../erro.js';

type Estado = Awaited<ReturnType<typeof window.jjs.celular.estado>>;

/**
 * Configurações > Celular do mecânico.
 *
 * O QR é gerado sob demanda e vale 10 minutos: ele fica exposto na tela do
 * balcão, onde passa cliente o tempo todo. Por isso não fica ligado à toa.
 */
export function CartaoCelular() {
  const { dados, erro, recarregar } = useConsulta<Estado>(() => window.jjs.celular.estado(), []);
  const [qr, setQr] = useState<{ url: string; qrDataUri: string; expiraEm: number } | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [aRevogar, setARevogar] = useState<{ id: number; nome: string } | null>(null);
  const [restam, setRestam] = useState(0);

  // Conta o tempo do QR na tela: o mecânico precisa saber que vai expirar.
  useEffect(() => {
    if (!qr) return;
    const tick = () => {
      const segundos = Math.max(0, Math.round((qr.expiraEm - Date.now()) / 1000));
      setRestam(segundos);
      if (segundos === 0) setQr(null);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [qr]);

  // Enquanto o QR está na tela, procura o celular que acabou de parear.
  useEffect(() => {
    if (!qr) return;
    const t = setInterval(() => recarregar(), 3000);
    return () => clearInterval(t);
  }, [qr, recarregar]);

  async function gerar() {
    setFalha(null);
    try {
      setQr(await window.jjs.celular.qr());
    } catch (causa) {
      setFalha(mensagemDeErro(causa));
    }
  }

  const ativos = (dados?.dispositivos ?? []).filter((d) => !d.revogado);

  return (
    <section className="rounded-card border border-jjs-borda bg-jjs-branco p-5">
      <h2 className="font-titulo text-2xl text-jjs-preto">Celular do mecânico</h2>
      <p className="mt-1 text-jjs-texto-fraco">
        O mecânico usa o celular na oficina para ver as OS, lançar serviço e tirar foto. Funciona
        pelo Wi-Fi da oficina, sem internet.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
        {falha ? <Aviso tom="erro">{falha}</Aviso> : null}
        {recado ? <Aviso tom="ok">{recado}</Aviso> : null}

        {dados && !dados.rodando ? (
          <Aviso tom="erro">{dados.erro ?? 'O acesso pelo celular não está no ar.'}</Aviso>
        ) : null}

        {dados?.rodando ? (
          <div className="rounded-card border border-jjs-borda p-4">
            <p className="text-sm text-jjs-texto-fraco">Endereço na rede da oficina</p>
            <p className="font-mono text-lg">{dados.url ?? 'sem rede'}</p>
            {dados.interfaceUsada ? (
              <p className="mt-1 text-sm text-jjs-texto-fraco">
                Pela interface {dados.interfaceUsada}. Vale pedir ao seu provedor para fixar esse IP
                no roteador: se ele mudar, os celulares param de achar o computador e será preciso
                parear de novo.
              </p>
            ) : null}
          </div>
        ) : null}

        {dados && dados.rodando && !dados.firewallOk ? (
          <div className="rounded-card border border-jjs-amarelo-escuro bg-jjs-amarelo/15 p-4">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldAlert size={20} />O Windows pode estar bloqueando o celular
            </p>
            <p className="mt-1 text-jjs-texto-fraco">
              Sem liberar a porta no firewall, o celular não conecta mesmo estando no Wi-Fi certo.
            </p>
            <div className="mt-2">
              <Botao
                variante="secundario"
                onClick={async () => {
                  const r = await window.jjs.celular.liberarFirewall();
                  setRecado(
                    r.liberou || r.jaExistia
                      ? 'Porta liberada no firewall.'
                      : 'Não consegui liberar. Pode ser preciso abrir o sistema como administrador.',
                  );
                  recarregar();
                }}
              >
                Liberar agora
              </Botao>
            </div>
          </div>
        ) : null}

        {qr ? (
          <div className="flex flex-wrap items-start gap-6">
            <img
              src={qr.qrDataUri}
              alt="QR code para conectar o celular"
              className="size-64 rounded-card border border-jjs-borda bg-white p-2"
            />
            <div className="max-w-sm">
              <ol className="list-decimal space-y-2 pl-5 text-lg">
                <li>Pegue o celular do mecânico.</li>
                <li>Abra a câmera e aponte para este QR code.</li>
                <li>Toque no link que aparecer.</li>
                <li>Digite o PIN do mecânico.</li>
              </ol>
              <p className="mt-3 text-jjs-texto-fraco">
                Vale por mais {Math.floor(restam / 60)}:{String(restam % 60).padStart(2, '0')}.
                Serve uma vez só.
              </p>
              <div className="mt-2">
                <Botao
                  variante="discreto"
                  onClick={() => {
                    void window.jjs.celular.cancelarQr();
                    setQr(null);
                  }}
                >
                  Cancelar
                </Botao>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <Botao
              variante="principal"
              tamanho="grande"
              icone={<QrCode size={22} />}
              disabled={!dados?.rodando}
              onClick={() => void gerar()}
            >
              Conectar um celular
            </Botao>
          </div>
        )}

        <div>
          <h3 className="font-titulo text-xl">
            Celulares conectados {ativos.length > 0 ? `(${ativos.length})` : ''}
          </h3>

          {ativos.length === 0 ? (
            <p className="mt-1 text-jjs-texto-fraco">Nenhum celular conectado ainda.</p>
          ) : (
            <ul className="mt-2 divide-y divide-jjs-borda rounded-card border border-jjs-borda">
              {ativos.map((d) => (
                <li key={d.id} className="flex min-h-toque items-center gap-3 px-4 py-2.5">
                  <Smartphone size={20} className="shrink-0 text-jjs-texto-fraco" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{d.nome}</span>
                    <span className="block text-sm text-jjs-texto-fraco">
                      {d.ultimoAcesso
                        ? `Usado em ${formatarDataHora(d.ultimoAcesso)}`
                        : 'nunca usou'}
                    </span>
                  </span>
                  {d.temSessaoAberta ? (
                    <span className="flex items-center gap-1 text-sm text-jjs-verde">
                      <Check size={16} /> em uso
                    </span>
                  ) : null}
                  <Botao
                    variante="discreto"
                    className="min-h-10 px-2 text-jjs-vermelho"
                    aria-label={`Desconectar ${d.nome}`}
                    onClick={() => setARevogar({ id: d.id, nome: d.nome })}
                  >
                    <X size={20} />
                  </Botao>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Confirmacao
        aberto={aRevogar !== null}
        titulo="Desconectar este celular?"
        mensagem={
          aRevogar
            ? `"${aRevogar.nome}" perde o acesso na hora. Para usar de novo, será preciso ler um QR code novo. Use isto se o celular foi perdido ou se a pessoa saiu da oficina.`
            : ''
        }
        rotuloConfirmar="Desconectar"
        perigo
        aoConfirmar={async () => {
          const alvo = aRevogar;
          setARevogar(null);
          if (alvo) {
            await window.jjs.celular.revogar(alvo.id);
            setRecado(`${alvo.nome} foi desconectado.`);
            recarregar();
          }
        }}
        aoCancelar={() => setARevogar(null)}
      />
    </section>
  );
}
