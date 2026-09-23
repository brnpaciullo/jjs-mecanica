import { useRef, useState } from 'react';
import { Camera, Video } from 'lucide-react';
import { ROTULO_MOMENTO, MOMENTOS_MIDIA, type MomentoMidia } from '@jjs/core';
import { filaDeUpload, reduzirFoto } from '../fila-upload.js';

/**
 * Câmera do mecânico.
 *
 * Usa `<input type="file" capture="environment">` e **não** `getUserMedia`:
 * a API de câmera do navegador exige HTTPS, e o servidor da oficina é HTTP na
 * rede local. O input abre a câmera nativa do celular, que funciona em HTTP e
 * ainda dá acesso ao flash e ao foco que o mecânico já sabe usar.
 */
export function CameraDoMecanico({ ordemId }: { ordemId: number }) {
  const foto = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLInputElement>(null);
  const [momento, setMomento] = useState<MomentoMidia>('servico');
  const [preparando, setPreparando] = useState(false);

  async function receber(arquivos: FileList | null, tipo: 'foto' | 'video') {
    const arquivo = arquivos?.[0];
    if (!arquivo) return;

    setPreparando(true);
    try {
      // Foto vai reduzida daqui: 4 MB no Wi-Fi da oficina é pedir para falhar.
      const conteudo = tipo === 'foto' ? await reduzirFoto(arquivo) : arquivo;

      filaDeUpload.adicionar({
        ordemId,
        nomeArquivo: arquivo.name || (tipo === 'foto' ? 'foto.jpg' : 'video.mp4'),
        tipo,
        momento,
        legenda: null,
        arquivo: conteudo,
      });
    } finally {
      setPreparando(false);
      if (foto.current) foto.current.value = '';
      if (video.current) video.current.value = '';
    }
  }

  return (
    <section className="rounded-card border border-jjs-borda bg-jjs-branco p-4">
      <h2 className="font-titulo text-xl">Registrar</h2>

      <p className="mt-2 text-sm font-semibold text-jjs-texto-fraco">Isto é de qual momento?</p>
      <div className="mt-1 flex gap-2">
        {MOMENTOS_MIDIA.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMomento(m)}
            className={
              'min-h-12 flex-1 rounded-campo border font-semibold ' +
              (momento === m
                ? 'border-jjs-amarelo-escuro bg-jjs-amarelo text-jjs-preto'
                : 'border-jjs-borda bg-jjs-branco')
            }
          >
            {ROTULO_MOMENTO[m]}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={preparando}
          onClick={() => foto.current?.click()}
          className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-card bg-jjs-amarelo font-titulo text-lg font-bold text-jjs-preto active:bg-jjs-amarelo-escuro disabled:opacity-60"
        >
          <Camera size={32} />
          Tirar foto
        </button>

        <button
          type="button"
          disabled={preparando}
          onClick={() => video.current?.click()}
          className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-card border border-jjs-borda bg-jjs-branco font-titulo text-lg font-bold active:bg-jjs-papel disabled:opacity-60"
        >
          <Video size={32} />
          Gravar vídeo
        </button>
      </div>

      <p className="mt-2 text-sm text-jjs-texto-fraco">
        Vídeo de até 1 minuto costuma bastar para mostrar o problema.
      </p>
      {preparando ? <p className="mt-1 text-sm">Preparando o arquivo...</p> : null}

      <input
        ref={foto}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void receber(e.target.files, 'foto')}
      />
      <input
        ref={video}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void receber(e.target.files, 'video')}
      />
    </section>
  );
}
