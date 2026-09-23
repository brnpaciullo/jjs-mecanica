import { describe, expect, it } from 'vitest';
import { escolherJid } from '../src/main/whatsapp/destino.js';

/**
 * O envio parecia funcionar e a mensagem não chegava: o JID era montado na mão
 * com o número do cadastro, e no Brasil a conta do WhatsApp muitas vezes está
 * registrada sem o nono dígito. O servidor aceita o envio para um JID que não
 * existe, sem reclamar.
 */
describe('escolherJid', () => {
  it('usa o JID que o servidor devolveu, não o número do cadastro', () => {
    // Cadastro com 9 dígitos, conta real sem o nono.
    const jid = escolherJid(
      [{ jid: '554199887766@s.whatsapp.net', exists: true }],
      '5541999887766',
    );
    expect(jid).toBe('554199887766@s.whatsapp.net');
  });

  it('avisa em português quando o número não tem WhatsApp', () => {
    expect(() =>
      escolherJid([{ jid: '5541999887766@s.whatsapp.net', exists: false }], '5541999887766'),
    ).toThrow(/não tem WhatsApp/);
    expect(() => escolherJid([{ jid: 'x', exists: false }], '5541999887766')).toThrow(
      /\(41\) 99988-7766/,
    );
  });

  it('não inventa destino quando o servidor não respondeu', () => {
    expect(() => escolherJid(undefined, '5541999887766')).toThrow(/não consegui confirmar/i);
    expect(() => escolherJid([], '5541999887766')).toThrow(/não consegui confirmar/i);
  });

  it('pega o primeiro que existe quando vem mais de um', () => {
    const jid = escolherJid(
      [
        { jid: 'a@s.whatsapp.net', exists: false },
        { jid: 'b@s.whatsapp.net', exists: true },
      ],
      '5541999887766',
    );
    expect(jid).toBe('b@s.whatsapp.net');
  });
});
