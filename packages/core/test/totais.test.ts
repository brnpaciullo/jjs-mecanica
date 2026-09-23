import { describe, expect, it } from 'vitest';
import {
  calcularTotais,
  formatarNumeroOs,
  lerNumeroOs,
  totalItem,
  type ItemCalculavel,
} from '../src/dominio/totais.js';

const peca = (valor: number, qtd = 1, aprovado = true): ItemCalculavel => ({
  tipo: 'peca',
  quantidade: qtd,
  valorUnitarioCentavos: valor,
  aprovado,
});

const mao = (valor: number, qtd = 1, aprovado = true): ItemCalculavel => ({
  tipo: 'mao_de_obra',
  quantidade: qtd,
  valorUnitarioCentavos: valor,
  aprovado,
});

describe('totalItem', () => {
  it('multiplica quantidade por valor unitário', () => {
    expect(totalItem({ quantidade: 3, valorUnitarioCentavos: 1050 })).toBe(3150);
  });

  it('aceita quantidade fracionada (1,5 hora de mão de obra)', () => {
    expect(totalItem({ quantidade: 1.5, valorUnitarioCentavos: 12000 })).toBe(18000);
  });

  it('mantém o resultado inteiro mesmo com fração quebrada', () => {
    const v = totalItem({ quantidade: 0.33, valorUnitarioCentavos: 999 });
    expect(Number.isInteger(v)).toBe(true);
  });
});

describe('calcularTotais', () => {
  it('separa peças de mão de obra', () => {
    const t = calcularTotais([peca(10000), peca(5000), mao(8000)]);
    expect(t.subtotalPecasCentavos).toBe(15000);
    expect(t.subtotalMaoDeObraCentavos).toBe(8000);
    expect(t.subtotalCentavos).toBe(23000);
    expect(t.totalCentavos).toBe(23000);
  });

  it('SÓ soma itens aprovados — é a base da aprovação parcial', () => {
    const t = calcularTotais([peca(10000), peca(5000, 1, false), mao(8000, 1, false)]);
    expect(t.subtotalPecasCentavos).toBe(10000);
    expect(t.subtotalMaoDeObraCentavos).toBe(0);
    expect(t.totalCentavos).toBe(10000);
    expect(t.itensNaoAprovados).toBe(2);
  });

  it('aplica o desconto', () => {
    const t = calcularTotais([peca(10000), mao(5000)], 2000);
    expect(t.descontoCentavos).toBe(2000);
    expect(t.totalCentavos).toBe(13000);
  });

  it('desconto maior que a conta zera o total, não deixa negativo', () => {
    const t = calcularTotais([peca(10000)], 99999);
    expect(t.descontoCentavos).toBe(10000);
    expect(t.totalCentavos).toBe(0);
  });

  it('desconto negativo é ignorado', () => {
    const t = calcularTotais([peca(10000)], -5000);
    expect(t.descontoCentavos).toBe(0);
    expect(t.totalCentavos).toBe(10000);
  });

  it('desconto só incide sobre o que foi aprovado', () => {
    const t = calcularTotais([peca(10000), peca(90000, 1, false)], 20000);
    // o desconto não pode "comer" o item recusado
    expect(t.descontoCentavos).toBe(10000);
    expect(t.totalCentavos).toBe(0);
  });

  it('OS sem item nenhum dá zero', () => {
    const t = calcularTotais([], 0);
    expect(t.subtotalCentavos).toBe(0);
    expect(t.totalCentavos).toBe(0);
    expect(t.itensNaoAprovados).toBe(0);
  });

  it('conta quantidade e fração junto', () => {
    const t = calcularTotais([peca(2550, 4), mao(12000, 1.5)]);
    expect(t.subtotalPecasCentavos).toBe(10200);
    expect(t.subtotalMaoDeObraCentavos).toBe(18000);
    expect(t.totalCentavos).toBe(28200);
  });

  it('todo total é inteiro, nunca float quebrado', () => {
    const t = calcularTotais([peca(333, 3), mao(1033, 1.5)], 7);
    for (const v of Object.values(t)) expect(Number.isInteger(v)).toBe(true);
  });
});

describe('formatarNumeroOs', () => {
  it('usa quatro dígitos', () => {
    expect(formatarNumeroOs(1)).toBe('OS 0001');
    expect(formatarNumeroOs(142)).toBe('OS 0142');
    expect(formatarNumeroOs(9999)).toBe('OS 9999');
  });

  it('não corta quando passa de quatro dígitos', () => {
    expect(formatarNumeroOs(12345)).toBe('OS 12345');
  });
});

describe('lerNumeroOs', () => {
  it('entende como a oficina escreve', () => {
    expect(lerNumeroOs('OS 142')).toBe(142);
    expect(lerNumeroOs('os142')).toBe(142);
    expect(lerNumeroOs('#142')).toBe(142);
    expect(lerNumeroOs('142')).toBe(142);
    expect(lerNumeroOs('  OS  0142 ')).toBe(142);
  });

  it('recusa o que não é número de OS', () => {
    expect(lerNumeroOs('ABC1234')).toBeNull();
    expect(lerNumeroOs('')).toBeNull();
    expect(lerNumeroOs('OS')).toBeNull();
    expect(lerNumeroOs('0')).toBeNull();
  });
});
