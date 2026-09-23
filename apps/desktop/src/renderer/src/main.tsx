import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@jjs/ui/fontes';
import './index.css';
import { instalarPonteDePrevia } from './ponte.js';
import { App } from './App.js';

// Antes de qualquer tela: no navegador não existe a ponte do preload, e sem
// isto a primeira consulta estoura e a janela fica branca.
instalarPonteDePrevia();

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Elemento raiz não encontrado no index.html');

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
