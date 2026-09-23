import { WifiOff } from 'lucide-react';

/**
 * A falha mais comum no dia a dia: o celular saiu do Wi-Fi da oficina ou o
 * notebook foi desligado. A tela diz exatamente o que conferir, em vez de um
 * "erro de rede" que não ajuda ninguém.
 */
export function SemConexao({ aoTentarDeNovo }: { aoTentarDeNovo: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-jjs-preto px-6 text-center text-white">
      <WifiOff size={64} className="text-jjs-amarelo" aria-hidden="true" />
      <h1 className="font-titulo text-3xl">Não encontrei o computador da oficina</h1>
      <ul className="max-w-sm list-disc space-y-2 text-left text-lg text-white/80">
        <li>O computador do balcão está ligado?</li>
        <li>O celular está no Wi-Fi da oficina?</li>
      </ul>
      <button
        type="button"
        onClick={aoTentarDeNovo}
        className="min-h-14 rounded-campo bg-jjs-amarelo px-8 text-lg font-semibold text-jjs-preto"
      >
        Tentar de novo
      </button>
    </div>
  );
}
