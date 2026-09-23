import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LimiteDeErro } from './componentes/LimiteDeErro.js';
import { Layout } from './componentes/Layout.js';
import { CarrosNaOficina } from './paginas/CarrosNaOficina.js';
import { AbrirAtendimento } from './paginas/AbrirAtendimento.js';
import { TelaOs } from './paginas/TelaOs.js';
import { Clientes } from './paginas/Clientes.js';
import { ClienteDetalhe } from './paginas/ClienteDetalhe.js';
import { VeiculoHistorico } from './paginas/VeiculoHistorico.js';
import { HistoricoDeOs } from './paginas/HistoricoDeOs.js';
import { Catalogo } from './paginas/Catalogo.js';
import { Configuracoes } from './paginas/Configuracoes.js';

/**
 * HashRouter e não BrowserRouter: no build empacotado a tela é carregada por
 * file://, onde caminho de URL não resolve.
 */
export function App() {
  return (
    <LimiteDeErro>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<CarrosNaOficina />} />
            <Route path="/atendimento/novo" element={<AbrirAtendimento />} />
            <Route path="/os/:id" element={<TelaOs />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/clientes/:id" element={<ClienteDetalhe />} />
            <Route path="/veiculos/:id" element={<VeiculoHistorico />} />
            <Route path="/historico" element={<HistoricoDeOs />} />
            <Route path="/catalogo" element={<Catalogo />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </LimiteDeErro>
  );
}
