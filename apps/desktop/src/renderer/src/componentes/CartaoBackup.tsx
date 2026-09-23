import { useState } from 'react';
import { FolderOpen, RotateCcw, Save } from 'lucide-react';
import { formatarDataHora } from '@jjs/core';
import type { BackupNaTela } from '../../../main/backup/fazer.js';
import type { ConteudoBackup } from '../../../main/backup/restaurar.js';
import { Botao } from '@jjs/ui';
import { Aviso } from './Aviso.js';
import { Confirmacao } from './Confirmacao.js';
import { useConsulta } from '../hooks/useConsulta.js';
import { mensagemDeErro } from '../erro.js';

interface Listagem {
  pasta: string;
  ultimoEm: string | null;
  backups: BackupNaTela[];
}

const emMB = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`;

/**
 * Backup em Configurações.
 *
 * O texto evita "backup incremental" e explica o que realmente acontece: o
 * banco vai inteiro todo dia, as fotos só quando são novas. Quem vai ler isso
 * não precisa saber o nome da técnica, precisa saber que os dados estão
 * salvos.
 */
export function CartaoBackup() {
  const { dados, erro, recarregar } = useConsulta<Listagem>(() => window.jjs.backup.listar(), []);
  const [ocupado, setOcupado] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [aRestaurar, setARestaurar] = useState<{
    arquivo: string;
    conteudo: ConteudoBackup;
  } | null>(null);

  async function executar(acao: () => Promise<unknown>, aviso?: string) {
    setOcupado(true);
    setFalha(null);
    setRecado(null);
    try {
      await acao();
      if (aviso) setRecado(aviso);
      recarregar();
    } catch (causa) {
      setFalha(mensagemDeErro(causa));
    } finally {
      setOcupado(false);
    }
  }

  async function escolherParaRestaurar() {
    setFalha(null);
    try {
      const escolha = await window.jjs.backup.escolherArquivo();
      if (escolha) setARestaurar(escolha);
    } catch (causa) {
      setFalha(mensagemDeErro(causa));
    }
  }

  return (
    <section className="rounded-card border border-jjs-borda bg-jjs-branco p-5">
      <h2 className="font-titulo text-2xl text-jjs-preto">Backup</h2>
      <p className="mt-1 text-jjs-texto-fraco">
        Todo dia o sistema salva uma cópia do banco. As fotos e vídeos entram só quando são novos,
        para o backup não ficar gigante.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
        {falha ? <Aviso tom="erro">{falha}</Aviso> : null}
        {recado ? <Aviso tom="ok">{recado}</Aviso> : null}

        <div className="rounded-card border border-jjs-borda p-4">
          <p className="text-sm text-jjs-texto-fraco">Último backup</p>
          <p className="text-lg">
            {dados?.ultimoEm ? formatarDataHora(dados.ultimoEm) : 'nenhum ainda'}
          </p>

          <p className="mt-3 text-sm text-jjs-texto-fraco">Pasta</p>
          <p className="break-all font-mono text-sm">{dados?.pasta ?? '...'}</p>

          <p className="mt-2 text-sm text-jjs-texto-fraco">
            Vale muito escolher uma pasta do Google Drive para computador: aí a cópia sai do
            notebook sozinha, e um problema no equipamento não leva os dados junto.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Botao
            variante="principal"
            icone={<Save size={18} />}
            disabled={ocupado}
            onClick={() =>
              void executar(() => window.jjs.backup.agora(), 'Backup feito agora mesmo.')
            }
          >
            {ocupado ? 'Salvando...' : 'Fazer backup agora'}
          </Botao>

          <Botao
            variante="secundario"
            icone={<FolderOpen size={18} />}
            disabled={ocupado}
            onClick={() => void executar(() => window.jjs.backup.escolherPasta())}
          >
            Trocar a pasta
          </Botao>

          <Botao
            variante="secundario"
            disabled={ocupado}
            onClick={() => void executar(() => window.jjs.backup.abrirPasta())}
          >
            Abrir a pasta
          </Botao>

          <Botao
            variante="secundario"
            icone={<RotateCcw size={18} />}
            disabled={ocupado}
            onClick={() => void escolherParaRestaurar()}
          >
            Restaurar um backup
          </Botao>
        </div>

        {dados && dados.backups.length > 0 ? (
          <details className="rounded-card border border-jjs-borda">
            <summary className="cursor-pointer px-4 py-3 font-semibold">
              {dados.backups.length} backup(s) guardado(s)
            </summary>
            <ul className="divide-y divide-jjs-borda border-t border-jjs-borda">
              {dados.backups.slice(0, 10).map((b) => (
                <li key={b.arquivo} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span className="tabular-nums">{formatarDataHora(b.quandoEm)}</span>
                  <span className="text-jjs-texto-fraco">{emMB(b.tamanhoBytes)}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      <Confirmacao
        aberto={aRestaurar !== null}
        titulo="Restaurar este backup?"
        mensagem={
          aRestaurar
            ? `Os dados de agora vão ser substituídos pelos do backup${
                aRestaurar.conteudo.temBanco ? '' : ' (este arquivo não tem banco, só fotos)'
              }. Antes de trocar, o sistema guarda uma cópia do banco atual, então dá para voltar. O sistema vai reiniciar sozinho no fim.`
            : ''
        }
        rotuloConfirmar="Restaurar e reiniciar"
        perigo
        aoConfirmar={() => {
          const escolha = aRestaurar;
          setARestaurar(null);
          if (escolha) {
            void executar(
              () => window.jjs.backup.restaurar(escolha.arquivo),
              'Backup restaurado. O sistema vai reiniciar.',
            );
          }
        }}
        aoCancelar={() => setARestaurar(null)}
      />
    </section>
  );
}
