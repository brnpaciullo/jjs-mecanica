import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@jjs/ui/fontes';
import './index.css';
import { App } from './App.js';

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Elemento raiz não encontrado.');

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
