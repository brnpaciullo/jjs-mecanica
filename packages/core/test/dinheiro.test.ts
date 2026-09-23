import { describe, expect, it } from 'vitest';
import {
  digitosParaCentavos,
  formatarDinheiro,
  formatarDinheiroSemSimbolo,
  lerDinheiro,
  multiplicarCentavos,
} from '../src/formato/dinheiro.js';

// O Intl do Node separa o "R$" do valor com espaco nao separavel (U+00A0).
const normalizar = (s: string) => s.replace(/\u00a0/g, ' ');

describe('formatarDinheiro', () => {
  it('formata centavos em reais', () => {
    expect(normalizar(formatarDinheiro(123456))).toBe('R$ 1.234,56');
    expect(normalizar(formatarDinheiro(0))).toBe('R$ 0,00');
    expect(normalizar(formatarDinheiro(5))).toBe('R$ 0,05');
    expect(normalizar(formatarDinheiro(100))).toBe('R$ 1,00');
  });

  it('formata valores grandes com separador de milhar', () => {
    expect(normalizar(formatarDinheiro(198765432))).toBe('R$ 1.987.654,32');
  });

  it('formata sem simbolo para as tabelas do PDF', () => {
    expect(formatarDinheiroSemSimbolo(123456)).toBe('1.234,56');
  });
});

describe('lerDinheiro', () => {
  it('le o que a secretaria digita', () => {
    expect(lerDinheiro('1.234,56')).toBe(123456);
    expect(lerDinheiro('R$ 1.234,56')).toBe(123456);
    expect(lerDinheiro('1234,56')).toBe(123456);
    expect(lerDinheiro('1234,5')).toBe(123450);
    expect(lerDinheiro('1234')).toBe(123400);
    expect(lerDinheiro('0,05')).toBe(5);
    expect(lerDinheiro(',5')).toBe(50);
  });

  it('trata o ponto como milhar quando sobram 3 digitos', () => {
    expect(lerDinheiro('1.234')).toBe(123400);
    expect(lerDinheiro('1.234.567')).toBe(123456700);
  });

  it('trata o ponto como decimal quando nao sobram 3 digitos', () => {
    expect(lerDinheiro('12.50')).toBe(1250);
    expect(lerDinheiro('12.5')).toBe(1250);
  });

  it('aceita negativo, para desconto lancado errado', () => {
    expect(lerDinheiro('-10,00')).toBe(-1000);
  });

  it('devolve null para o que nao e valor', () => {
    expect(lerDinheiro('')).toBeNull();
    expect(lerDinheiro('   ')).toBeNull();
    expect(lerDinheiro('abc')).toBeNull();
    expect(lerDinheiro('12,345')).toBeNull();
  });
});

describe('digitosParaCentavos', () => {
  it('trata os dois ultimos digitos como centavos', () => {
    expect(digitosParaCentavos('12350')).toBe(12350);
    expect(digitosParaCentavos('R$ 12.350')).toBe(12350);
    expect(digitosParaCentavos('')).toBe(0);
  });
});

describe('multiplicarCentavos', () => {
  it('mantem o resultado inteiro', () => {
    expect(multiplicarCentavos(1050, 3)).toBe(3150);
    expect(multiplicarCentavos(1000, 0.5)).toBe(500);
    expect(multiplicarCentavos(333, 3)).toBe(999);
    expect(Number.isInteger(multiplicarCentavos(1033, 1.5))).toBe(true);
  });
});
