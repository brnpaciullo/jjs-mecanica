import { describe, expect, it } from 'vitest';
import {
  ehCelular,
  formatarTelefone,
  mascararTelefone,
  normalizarTelefone,
  paraWhatsApp,
} from '../src/formato/telefone.js';

describe('normalizarTelefone', () => {
  it('completa com o DDD 41 quando o cliente dita so o numero', () => {
    expect(normalizarTelefone('99999-9999')).toBe('5541999999999');
    expect(normalizarTelefone('3333-4444')).toBe('554133334444');
  });

  it('aceita numero com DDD', () => {
    expect(normalizarTelefone('(11) 98888-7777')).toBe('5511988887777');
    expect(normalizarTelefone('41 3333 4444')).toBe('554133334444');
  });

  it('aceita numero ja com codigo do pais', () => {
    expect(normalizarTelefone('+55 41 99999-9999')).toBe('5541999999999');
    expect(normalizarTelefone('5541999999999')).toBe('5541999999999');
  });

  it('nao confunde o DDD 55 com o codigo do pais', () => {
    expect(normalizarTelefone('55 99999-8888')).toBe('5555999998888');
  });

  it('respeita um DDD padrao diferente', () => {
    expect(normalizarTelefone('99999-9999', '11')).toBe('5511999999999');
  });

  it('recusa o que nao e telefone', () => {
    expect(normalizarTelefone('')).toBeNull();
    expect(normalizarTelefone('123')).toBeNull();
    expect(normalizarTelefone('41 89999-9999')).toBeNull();
    expect(normalizarTelefone('41 1234-5678')).toBeNull();
    expect(normalizarTelefone('01 99999-9999')).toBeNull();
  });
});

describe('ehCelular', () => {
  it('separa celular de fixo', () => {
    expect(ehCelular('5541999999999')).toBe(true);
    expect(ehCelular('554133334444')).toBe(false);
  });
});

describe('formatarTelefone', () => {
  it('formata celular e fixo', () => {
    expect(formatarTelefone('5541999999999')).toBe('(41) 99999-9999');
    expect(formatarTelefone('554133334444')).toBe('(41) 3333-4444');
  });
});

describe('mascararTelefone', () => {
  it('vai montando a mascara conforme digita', () => {
    expect(mascararTelefone('4')).toBe('(4');
    expect(mascararTelefone('41')).toBe('(41');
    expect(mascararTelefone('41999')).toBe('(41) 999');
    expect(mascararTelefone('4133334444')).toBe('(41) 3333-4444');
    expect(mascararTelefone('41999999999')).toBe('(41) 99999-9999');
  });

  it('ignora o que passa de 11 digitos', () => {
    expect(mascararTelefone('419999999999999')).toBe('(41) 99999-9999');
  });
});

describe('paraWhatsApp', () => {
  it('deixa so os digitos para o link wa.me', () => {
    expect(paraWhatsApp('+55 41 99999-9999')).toBe('5541999999999');
  });
});
