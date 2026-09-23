import { NavLink } from 'react-router-dom';
import { BookOpen, Car, ClipboardList, Inbox, Search, Settings, Users } from 'lucide-react';
import { cn } from '@jjs/ui';
import { pedirBusca } from '../eventos.js';
import { IndicadorWhatsApp } from './IndicadorWhatsApp.js';

/** Os destinos usam a linguagem da oficina, não nomes de sistema. */
const DESTINOS = [
  { para: '/', rotulo: 'Carros na oficina', Icone: Car },
  { para: '/clientes', rotulo: 'Clientes', Icone: Users },
  { para: '/historico', rotulo: 'Histórico de OS', Icone: ClipboardList },
  { para: '/catalogo', rotulo: 'Catálogo', Icone: BookOpen },
  { para: '/midias-sem-os', rotulo: 'Mídias sem OS', Icone: Inbox },
  { para: '/configuracoes', rotulo: 'Configurações', Icone: Settings },
] as const;

/**
 * Preto da fachada. A área de trabalho é clara; o preto fica na lateral e nos
 * cabeçalhos.
 */
export function BarraLateral() {
  return (
    <nav className="flex w-60 shrink-0 flex-col bg-jjs-preto text-white">
      <div className="px-5 pb-5 pt-6">
        <p className="font-titulo text-3xl font-bold italic leading-none text-jjs-amarelo">JJS</p>
        <p className="mt-1 font-titulo text-sm uppercase tracking-[0.18em] text-white/60">
          Mecânica
        </p>
      </div>

      {/* Atalho da busca: fica visível para quem não sabe que existe. */}
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={pedirBusca}
          className="flex min-h-toque w-full items-center gap-2.5 rounded-campo border border-white/15 px-3 text-left text-white/70 transition-colors hover:bg-jjs-grafite hover:text-white"
        >
          <Search size={20} aria-hidden="true" />
          <span className="flex-1">Buscar placa...</span>
          <kbd className="rounded border border-white/20 px-1.5 py-0.5 text-xs">Ctrl+K</kbd>
        </button>
      </div>

      <ul className="flex flex-1 flex-col gap-1 px-3">
        {DESTINOS.map(({ para, rotulo, Icone }) => (
          <li key={para}>
            <NavLink
              to={para}
              end={para === '/'}
              className={({ isActive }) =>
                cn(
                  'flex min-h-toque items-center gap-3 rounded-campo px-3 text-base font-medium',
                  'transition-colors',
                  isActive
                    ? 'bg-jjs-amarelo font-semibold text-jjs-preto'
                    : 'text-white/85 hover:bg-jjs-grafite hover:text-white',
                )
              }
            >
              <Icone size={22} aria-hidden="true" />
              {rotulo}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="border-t border-white/10 p-3">
        <IndicadorWhatsApp />
      </div>
    </nav>
  );
}
