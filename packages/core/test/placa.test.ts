import { describe, expect, it } from 'vitest';
import { ehPlacaValida, formatarPlaca, normalizarPlaca, tipoPlaca } from '../src/formato/placa.js';

describe('normalizarPlaca', () => {
  it('deixa maiuscula e tira hifen e espaco', () => {
    expect(normalizarPlaca('abc-1234')).toBe('ABC1234');
    expect(normalizarPlaca(' abc 1d23 ')).toBe('ABC1D23');
  });

  it('corta o que passa de 7 caracteres', () => {
    expect(normalizarPlaca('ABC12345678')).toBe('ABC1234');
  });
});

describe('tipoPlaca', () => {
  it('reconhece o formato antigo', () => {
    expect(tipoPlaca('ABC-1234')).toBe('antiga');
  });

  it('reconhece o Mercosul', () => {
    expect(tipoPlaca('ABC1D23')).toBe('mercosul');
  });

  it('devolve null para placa invalida', () => {
    expect(tipoPlaca('AB-1234')).toBeNull();
    expect(tipoPlaca('ABCD123')).toBeNull();
    expect(tipoPlaca('1234ABC')).toBeNull();
    expect(tipoPlaca('')).toBeNull();
    expect(tipoPlaca('ABC12D3')).toBeNull();
  });
});

describe('ehPlacaValida', () => {
  it('aceita os dois formatos', () => {
    expect(ehPlacaValida('abc1234')).toBe(true);
    expect(ehPlacaValida('ABC1D23')).toBe(true);
    expect(ehPlacaValida('ABC123')).toBe(false);
  });
});

describe('formatarPlaca', () => {
  it('poe o hifen so no formato antigo', () => {
    expect(formatarPlaca('ABC1234')).toBe('ABC-1234');
    expect(formatarPlaca('ABC1D23')).toBe('ABC1D23');
  });

  it('formata a partir do que foi digitado', () => {
    expect(formatarPlaca('abc1234')).toBe('ABC-1234');
  });
});
