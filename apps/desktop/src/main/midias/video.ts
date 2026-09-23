import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import ffmpeg from 'fluent-ffmpeg';
import { log } from '../log.js';

const exigir = createRequire(__filename);

/**
 * Caminho do ffmpeg empacotado.
 *
 * O `ffmpeg-static` baixa o binário num script de instalação — e o npm 12
 * **bloqueia scripts de dependência por padrão**. Quando isso acontece o
 * pacote existe mas o binário não, e a conversão falharia com um erro
 * incompreensível. Por isso a checagem é do arquivo, não do módulo.
 */
function caminhoDoFfmpeg(): string | null {
  try {
    const caminho = exigir('ffmpeg-static') as string | null;
    if (typeof caminho === 'string' && existsSync(caminho)) return caminho;

    log.warn(
      '[mídias] o binário do ffmpeg não foi baixado. Vídeos ficam no formato original. ' +
        'Para habilitar a conversão: npm install-scripts approve ffmpeg-static && npm install',
    );
    return null;
  } catch (erro) {
    log.warn('[mídias] ffmpeg-static indisponível', erro);
    return null;
  }
}

let caminho: string | null | undefined;

export function ffmpegDisponivel(): boolean {
  if (caminho === undefined) {
    caminho = caminhoDoFfmpeg();
    if (caminho) ffmpeg.setFfmpegPath(caminho);
  }
  return caminho !== null;
}

/**
 * Converte para H.264 720p.
 *
 * Um vídeo de celular tem dezenas de megabytes e não passa no WhatsApp. Os
 * parâmetros miram "leve o bastante para enviar, nítido o bastante para o
 * cliente ver a peça": CRF 28 é bem comprimido, 720p basta para mostrar um
 * disco riscado, e `+faststart` põe o índice no começo do arquivo para o vídeo
 * começar a tocar antes de baixar inteiro.
 */
export function converterVideo(origem: string, destino: string): Promise<void> {
  if (!ffmpegDisponivel()) return Promise.reject(new Error('ffmpeg não está disponível.'));

  return new Promise((resolver, rejeitar) => {
    ffmpeg(origem)
      .videoCodec('libx264')
      .outputOptions([
        '-preset veryfast',
        '-crf 28',
        '-movflags +faststart',
        // Só reduz; vídeo que já é menor que 720p passa direto.
        '-vf scale=-2:min(720\\,ih)',
        '-pix_fmt yuv420p',
      ])
      .audioCodec('aac')
      .audioBitrate('96k')
      .on('end', () => resolver())
      .on('error', (erro) => rejeitar(erro))
      .save(destino);
  });
}

/** Miniatura do primeiro segundo — o frame zero costuma ser escuro. */
export function gerarThumbDeVideo(video: string, destino: string): Promise<void> {
  if (!ffmpegDisponivel()) return Promise.reject(new Error('ffmpeg não está disponível.'));

  return new Promise((resolver, rejeitar) => {
    ffmpeg(video)
      .on('end', () => resolver())
      .on('error', (erro) => rejeitar(erro))
      .screenshots({
        timestamps: ['1'],
        filename: destino.split(/[\\/]/).pop() ?? 'thumb.jpg',
        folder: destino.replace(/[\\/][^\\/]+$/, ''),
        size: '400x?',
      });
  });
}
