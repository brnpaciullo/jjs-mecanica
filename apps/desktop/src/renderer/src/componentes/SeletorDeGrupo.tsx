import { useMemo, useState } from 'react';
import { Check, Loader2, Users } from 'lucide-react';
import { Botao, Campo } from '@jjs/ui';
import type { ConfigRegistro } from '@jjs/db';
import { useConsulta } from '../hooks/useConsulta.js';
import { Aviso } from './Aviso.js';
import { mensagemDeErro } from '../erro.js';

interface Props {
  config: ConfigRegistro | null;
  aoTrocar: () => void;
}

/**
 * Configurações > WhatsApp > grupo das fotos.
 *
 * A lista só é buscada quando a oficina clica em "Trocar": puxar dezenas de
 * grupos do WhatsApp toda vez que a tela abre seria lento à toa, e na maior
 * parte das visitas ninguém vai mexer nisso.
 *
 * O filtro por nome existe porque uma conta de oficina vive em muitos grupos —
 * fornecedor, família, bairro. Rolar tudo até achar o certo é ruim; digitar
 * três letras não.
 */
export function SeletorDeGrupo({ config, aoTrocar }: Props) {
  const [escolhendo, setEscolhendo] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const grupos = useConsulta(() => window.jjs.whatsapp.grupos(), [escolhendo]);
  const ativo = config?.whatsappGrupoJid ?? null;

  const visiveis = useMemo(() => {
    const busca = filtro.trim().toLocaleLowerCase('pt-BR');
    const todos = grupos.dados ?? [];
    if (!busca) return todos;
    return todos.filter((g) => g.nome.toLocaleLowerCase('pt-BR').includes(busca));
  }, [grupos.dados, filtro]);

  async function definir(jid: string | null, nome: string | null) {
    setSalvando(true);
    setErro(null);
    try {
      await window.jjs.whatsapp.definirGrupo(jid, nome);
      setEscolhendo(false);
      setFiltro('');
      aoTrocar();
    } catch (causa) {
      setErro(mensagemDeErro(causa));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-card border border-jjs-borda p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Users size={24} className="text-jjs-texto-fraco" aria-hidden="true" />
          <div>
            <p className="font-semibold">Fotos do mecânico chegam por</p>
            <p className="text-jjs-texto-fraco">
              {ativo ? (
                <>
                  grupo <strong>{config?.whatsappGrupoNome ?? ativo}</strong>
                </>
              ) : (
                'nenhum grupo — só a conversa da oficina consigo mesma'
              )}
            </p>
          </div>
        </div>

        <Botao
          variante="secundario"
          disabled={salvando}
          onClick={() => {
            setEscolhendo((antes) => !antes);
            setFiltro('');
            setErro(null);
          }}
        >
          {escolhendo ? 'Cancelar' : ativo ? 'Trocar grupo' : 'Escolher grupo'}
        </Botao>
      </div>

      {erro ? (
        <div className="mt-3">
          <Aviso tom="erro">{erro}</Aviso>
        </div>
      ) : null}

      {escolhendo ? (
        <div className="mt-4 flex flex-col gap-3">
          <Campo
            rotulo="Procurar pelo nome do grupo"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Mecânica JJS"
            autoFocus
          />

          {grupos.erro ? <Aviso tom="erro">{grupos.erro}</Aviso> : null}

          {grupos.carregando ? (
            <p className="flex items-center gap-2 text-jjs-texto-fraco">
              <Loader2 size={20} className="animate-spin" />
              Buscando os grupos do WhatsApp...
            </p>
          ) : null}

          {!grupos.carregando && !grupos.erro ? (
            <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              {visiveis.map((grupo) => (
                <li key={grupo.jid}>
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={() => void definir(grupo.jid, grupo.nome)}
                    className="flex w-full items-center justify-between gap-3 rounded-card border border-transparent px-3 py-2 text-left hover:border-jjs-borda hover:bg-jjs-fundo disabled:opacity-50"
                  >
                    <span>
                      <span className="font-semibold">{grupo.nome}</span>
                      <span className="block text-jjs-texto-fraco">
                        {grupo.participantes} participante{grupo.participantes === 1 ? '' : 's'}
                      </span>
                    </span>
                    {grupo.jid === ativo ? (
                      <Check size={20} className="text-jjs-verde" aria-hidden="true" />
                    ) : null}
                  </button>
                </li>
              ))}

              {visiveis.length === 0 ? (
                <li className="px-3 py-2 text-jjs-texto-fraco">
                  {(grupos.dados ?? []).length === 0
                    ? 'O número da oficina não está em nenhum grupo. Crie o grupo no celular e adicione a oficina nele.'
                    : `Nenhum grupo com "${filtro}" no nome.`}
                </li>
              ) : null}
            </ul>
          ) : null}

          {ativo ? (
            <div>
              <Botao variante="secundario" disabled={salvando} onClick={() => void definir(null, null)}>
                Não usar grupo nenhum
              </Botao>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
