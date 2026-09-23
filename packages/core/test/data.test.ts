import { describe, expect, it } from 'vitest';
import {
  diasNaOficina,
  estaVencido,
  formatarData,
  formatarDataHora,
  formatarDiasNaOficina,
  lerData,
  somarDias,
} from '../src/formato/data.js';

// Datas montadas com o construtor local para o teste nao depender do fuso.
const local = (a: number, m: number, d: number, h = 12, min = 0) => new Date(a, m - 1, d, h, min);

describe('formatarData', () => {
  it('mostra dd/mm/aaaa', () => {
    expect(formatarData(local(2026, 9, 22))).toBe('22/09/2026');
    expect(formatarData(local(2026, 1, 5))).toBe('05/01/2026');
  });

  it('usa o fuso local, nao UTC', () => {
    // 23h do dia 22 continua sendo dia 22 na tela.
    expect(formatarData(local(2026, 9, 22, 23, 30))).toBe('22/09/2026');
  });

  it('devolve vazio para data invalida', () => {
    expect(formatarData('nada disso')).toBe('');
  });
});

describe('formatarDataHora', () => {
  it('junta data e hora', () => {
    expect(formatarDataHora(local(2026, 9, 22, 14, 30))).toBe('22/09/2026 14:30');
  });
});

describe('lerData', () => {
  it('le dd/mm/aaaa', () => {
    const iso = lerData('22/09/2026');
    expect(iso).not.toBeNull();
    expect(formatarData(iso as string)).toBe('22/09/2026');
  });

  it('aceita dia e mes com um digito', () => {
    expect(formatarData(lerData('5/1/2026') as string)).toBe('05/01/2026');
  });

  it('recusa data que nao existe', () => {
    expect(lerData('31/02/2026')).toBeNull();
    expect(lerData('22/13/2026')).toBeNull();
    expect(lerData('22-09-2026')).toBeNull();
    expect(lerData('')).toBeNull();
  });
});

describe('somarDias', () => {
  it('soma os dias de validade do orcamento', () => {
    expect(formatarData(somarDias(local(2026, 9, 22), 7))).toBe('29/09/2026');
  });

  it('vira o mes', () => {
    expect(formatarData(somarDias(local(2026, 9, 28), 7))).toBe('05/10/2026');
  });
});

describe('diasNaOficina', () => {
  it('conta dias de calendario', () => {
    expect(diasNaOficina(local(2026, 9, 22), local(2026, 9, 22))).toBe(0);
    expect(diasNaOficina(local(2026, 9, 22), local(2026, 9, 23))).toBe(1);
    expect(diasNaOficina(local(2026, 9, 10), local(2026, 9, 22))).toBe(12);
  });

  it('entrou ontem a noite ja conta 1 dia de manha cedo', () => {
    expect(diasNaOficina(local(2026, 9, 22, 23, 0), local(2026, 9, 23, 1, 0))).toBe(1);
  });
});

describe('formatarDiasNaOficina', () => {
  it('usa a linguagem do card', () => {
    expect(formatarDiasNaOficina(local(2026, 9, 22), local(2026, 9, 22))).toBe('hoje');
    expect(formatarDiasNaOficina(local(2026, 9, 22), local(2026, 9, 23))).toBe('1 dia');
    expect(formatarDiasNaOficina(local(2026, 9, 22), local(2026, 9, 27))).toBe('5 dias');
  });
});

describe('estaVencido', () => {
  it('compara com a validade', () => {
    expect(estaVencido(local(2026, 9, 22).toISOString(), local(2026, 9, 23))).toBe(true);
    expect(estaVencido(local(2026, 9, 25).toISOString(), local(2026, 9, 23))).toBe(false);
  });

  it('orcamento sem validade nunca vence', () => {
    expect(estaVencido(null)).toBe(false);
    expect(estaVencido(undefined)).toBe(false);
  });
});
