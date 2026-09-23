// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

// O módulo de envio arrasta Electron e Baileys atrás. Só a formatação do
// resumo interessa aqui, e ela não toca em nenhum dos dois.
vi.mock('electron', () => ({ shell: {}, Notification: class {} }));
vi.mock('@whiskeysockets/baileys', () => ({}));

const { resumoDeMidias } = await import('../src/main/whatsapp/envio.js');

/**
 * O resumo vai para o recado na tela e para o log. Plural errado num sistema
 * que o dono da oficina lê o dia inteiro é o tipo de coisa que passa a
 * impressão de software mal feito.
 */
describe('resumo do que foi enviado', () => {
  it('conta foto e vídeo juntos', () => {
    expect(resumoDeMidias(2, 1)).toBe('2 fotos e 1 vídeo');
  });

  it('não pluraliza no singular', () => {
    expect(resumoDeMidias(1, 0)).toBe('1 foto');
    expect(resumoDeMidias(0, 1)).toBe('1 vídeo');
  });

  it('pluraliza os dois', () => {
    expect(resumoDeMidias(3, 2)).toBe('3 fotos e 2 vídeos');
  });

  it('omite o que não foi', () => {
    expect(resumoDeMidias(0, 2)).toBe('2 vídeos');
    expect(resumoDeMidias(4, 0)).toBe('4 fotos');
  });

  it('vazio quando nada saiu — quem chama usa isso para mudar a frase', () => {
    expect(resumoDeMidias(0, 0)).toBe('');
  });
});
