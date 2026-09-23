import { useNavigate } from 'react-router-dom';
import { Loader2, MessageCircle, QrCode } from 'lucide-react';
import { formatarTelefone } from '@jjs/core';
import { useWhatsApp } from '../hooks/useWhatsApp.js';

/**
 * O estado do WhatsApp fica sempre visível: é por ele que o orçamento sai da
 * oficina, e descobrir que caiu só na hora de enviar é tarde demais.
 * Clicar leva direto para onde se resolve.
 */
export function IndicadorWhatsApp() {
  const navegar = useNavigate();
  const estado = useWhatsApp();

  const visual = {
    conectado: {
      cor: 'text-jjs-verde',
      rotulo: 'Conectado',
      Icone: MessageCircle,
      girando: false,
    },
    conectando: {
      cor: 'text-white/70',
      rotulo: 'Conectando...',
      Icone: Loader2,
      girando: true,
    },
    lendo_qr: {
      cor: 'text-jjs-amarelo',
      rotulo: 'Leia o QR code',
      Icone: QrCode,
      girando: false,
    },
    desconectado: {
      cor: 'text-white/45',
      rotulo: 'Desconectado',
      Icone: MessageCircle,
      girando: false,
    },
  }[estado.situacao];

  const { Icone } = visual;

  return (
    <button
      type="button"
      onClick={() => navegar('/configuracoes')}
      className="flex w-full items-center gap-2.5 rounded-campo px-3 py-2.5 text-left hover:bg-jjs-grafite"
    >
      <span className={visual.cor} aria-hidden="true">
        <Icone size={20} className={visual.girando ? 'animate-spin' : undefined} />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="text-sm font-semibold text-white">WhatsApp</p>
        {/* Cor + ícone + texto, nunca só cor. */}
        <p className={`truncate text-xs ${visual.cor}`}>
          {estado.situacao === 'conectado' && estado.numero
            ? formatarTelefone(estado.numero)
            : visual.rotulo}
        </p>
      </div>
      {estado.naFila > 0 ? (
        <span
          className="ml-auto rounded-full bg-jjs-amarelo px-1.5 text-xs font-bold text-jjs-preto"
          title={`${estado.naFila} mensagem(ns) na fila`}
        >
          {estado.naFila}
        </span>
      ) : null}
    </button>
  );
}
