import { QrCode } from 'lucide-react';

export function NaoPareado() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-jjs-preto px-6 text-center text-white">
      <QrCode size={64} className="text-jjs-amarelo" aria-hidden="true" />
      <h1 className="font-titulo text-3xl">Este celular ainda não está conectado</h1>
      <p className="max-w-sm text-lg text-white/80">
        No computador do balcão, abra <strong className="text-white">Configurações</strong> e depois{' '}
        <strong className="text-white">Celular do mecânico</strong>. Aponte a câmera para o QR code
        que aparecer.
      </p>
    </div>
  );
}
