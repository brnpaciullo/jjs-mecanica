import { lerNumeroOs, normalizarPlaca } from '@jjs/core';
import { listarClientes } from './clientes.js';
import { buscarOrdemPorNumero, detalharOrdem, listarHistorico } from './ordens.js';
import { listarVeiculos } from './veiculos.js';
import type { Contexto } from './contexto.js';

export type TipoResultado = 'veiculo' | 'cliente' | 'ordem';

/** Um resultado da busca global, pronto para a tela desenhar sem pensar. */
export interface ResultadoBusca {
  tipo: TipoResultado;
  id: number;
  /** O que aparece em destaque: placa, nome do cliente ou "OS 0001". */
  titulo: string;
  /** A linha de apoio: modelo e dono, telefone, ou o carro da OS. */
  detalhe: string;
  /** Para onde a tela navega ao escolher. */
  rota: string;
  placa?: string;
}

/**
 * Busca global do Ctrl+K: um campo só que acha placa, nome, telefone e número
 * de OS. A ordem importa — placa e OS vêm primeiro porque é como a oficina
 * procura no dia a dia ("o Gol prata, ABC-1234").
 */
export function buscaGlobal(ctx: Contexto, termo: string, limite = 12): ResultadoBusca[] {
  const busca = (termo ?? '').trim();
  if (busca.length < 2) return [];

  const resultados: ResultadoBusca[] = [];

  // 1. Número de OS digitado direto ("142", "OS 142", "#142")
  const numero = lerNumeroOs(busca);
  if (numero !== null) {
    const ordem = buscarOrdemPorNumero(ctx, numero);
    if (ordem) {
      const detalhe = detalharOrdem(ctx, ordem.id);
      if (detalhe) {
        resultados.push({
          tipo: 'ordem',
          id: detalhe.id,
          titulo: `OS ${String(detalhe.numero).padStart(4, '0')}`,
          detalhe: `${detalhe.marca} ${detalhe.modelo} · ${detalhe.clienteNome}`,
          rota: `/os/${detalhe.id}`,
          placa: detalhe.placa,
        });
      }
    }
  }

  // 2. Carros: por placa, modelo, marca ou nome do dono
  for (const veiculo of listarVeiculos(ctx, busca).slice(0, limite)) {
    resultados.push({
      tipo: 'veiculo',
      id: veiculo.id,
      titulo: veiculo.placa,
      detalhe: `${veiculo.marca} ${veiculo.modelo} · ${veiculo.clienteNome}`,
      rota: `/veiculos/${veiculo.id}`,
      placa: veiculo.placa,
    });
  }

  // 3. Clientes: por nome, telefone ou CPF
  for (const cliente of listarClientes(ctx, busca).slice(0, limite)) {
    resultados.push({
      tipo: 'cliente',
      id: cliente.id,
      titulo: cliente.nome,
      detalhe: cliente.telefone,
      rota: `/clientes/${cliente.id}`,
    });
  }

  // 4. Se a busca parece uma placa completa, mostra também as OS daquele carro
  const placa = normalizarPlaca(busca);
  if (placa.length === 7) {
    for (const ordem of listarHistorico(ctx, { limite: 200 })) {
      if (ordem.placa !== placa) continue;
      resultados.push({
        tipo: 'ordem',
        id: ordem.id,
        titulo: `OS ${String(ordem.numero).padStart(4, '0')}`,
        detalhe: `${ordem.marca} ${ordem.modelo} · ${ordem.clienteNome}`,
        rota: `/os/${ordem.id}`,
        placa: ordem.placa,
      });
    }
  }

  // Tira repetido mantendo a ordem de relevância acima.
  const vistos = new Set<string>();
  return resultados
    .filter((r) => {
      const chave = `${r.tipo}:${r.id}`;
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    })
    .slice(0, limite);
}
