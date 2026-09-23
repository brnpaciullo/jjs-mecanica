import { useCallback, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErroDaApi, api, type Eu } from './api.js';
import { Carregando } from './componentes/Carregando.js';
import { SemConexao } from './componentes/SemConexao.js';
import { Entrar } from './telas/Entrar.js';
import { NaoPareado } from './telas/NaoPareado.js';
import { Carros } from './telas/Carros.js';
import { TelaOs } from './telas/TelaOs.js';
import { NovoAtendimento } from './telas/NovoAtendimento.js';

type Situacao = 'carregando' | 'sem_conexao' | 'nao_pareado' | 'sem_pin' | 'dentro';

/**
 * Antes de qualquer tela, o app precisa saber em qual dos quatro estados está:
 * sem achar o computador, sem estar pareado, pareado mas sem PIN, ou dentro.
 * Cada um leva a uma tela diferente, com uma instrução diferente.
 */
export function App() {
  const [situacao, setSituacao] = useState<Situacao>('carregando');
  const [eu, setEu] = useState<Eu | null>(null);

  const conferir = useCallback(async () => {
    try {
      const resposta = await api.eu();
      setEu(resposta);
      setSituacao(resposta.precisaDePin ? 'sem_pin' : 'dentro');
    } catch (erro) {
      if (erro instanceof ErroDaApi && erro.semConexao) setSituacao('sem_conexao');
      else if (erro instanceof ErroDaApi && erro.precisaParear) setSituacao('nao_pareado');
      else setSituacao('nao_pareado');
    }
  }, []);

  useEffect(() => {
    // `Promise.resolve().then` e nao a chamada direta: o React 19 reclama de
    // setState sincrono dentro de efeito (renderizacao em cascata), e a funcao
    // marca "carregando" logo na primeira linha.
    void Promise.resolve().then(conferir);
  }, [conferir]);

  if (situacao === 'carregando') return <Carregando />;
  if (situacao === 'sem_conexao') return <SemConexao aoTentarDeNovo={() => void conferir()} />;
  if (situacao === 'nao_pareado') return <NaoPareado />;
  if (situacao === 'sem_pin') return <Entrar aoEntrar={() => void conferir()} />;

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Carros nome={eu?.dispositivo ?? null} />} />
        <Route path="/os/:id" element={<TelaOs />} />
        <Route path="/novo" element={<NovoAtendimento />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
