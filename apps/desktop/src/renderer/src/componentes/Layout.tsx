import { Outlet } from 'react-router-dom';
import { BarraLateral } from './BarraLateral.js';
import { BuscaGlobal } from './BuscaGlobal.js';

export function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-jjs-papel">
      <BarraLateral />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      {/* Ctrl+K funciona de qualquer tela. */}
      <BuscaGlobal />
    </div>
  );
}
