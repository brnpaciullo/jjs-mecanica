// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { WAMessage, WASocket } from '@whiskeysockets/baileys';
import { ehDaFonteCerta, remetenteDe } from '../src/main/whatsapp/receber.js';

/**
 * De onde o sistema aceita foto.
 *
 * Esta é a regra que já falhou na mão da oficina: mandar a foto na conversa
 * consigo mesma do celular *pessoal* não fazia nada, porque quem é escutado é
 * o número da oficina. O grupo existe para resolver isso — e o teste guarda
 * as duas fontes para nenhuma delas voltar a aceitar o que não devia.
 */
const OFICINA = '5541988887777';
const MECANICO = '5541999996666';
const GRUPO = '120363000000000000@g.us';

const socket = { user: { id: `${OFICINA}:12@s.whatsapp.net` } } as unknown as WASocket;

function mensagem(de: string, participante?: string): WAMessage {
  return {
    key: {
      remoteJid: de,
      fromMe: de.startsWith(OFICINA),
      ...(participante ? { participant: `${participante}@s.whatsapp.net` } : {}),
    },
  } as WAMessage;
}

describe('sem grupo escolhido: só o chat da oficina consigo mesma', () => {
  it('aceita a oficina falando consigo mesma', () => {
    expect(ehDaFonteCerta(socket, mensagem(`${OFICINA}@s.whatsapp.net`), null)).toBe(true);
  });

  it('recusa a conversa do mecânico consigo mesmo — foi o que confundiu na oficina', () => {
    expect(ehDaFonteCerta(socket, mensagem(`${MECANICO}@s.whatsapp.net`), null)).toBe(false);
  });

  it('recusa a conversa com um cliente, mesmo sendo a oficina que enviou', () => {
    const paraCliente = mensagem(`${MECANICO}@s.whatsapp.net`);
    paraCliente.key.fromMe = true;
    expect(ehDaFonteCerta(socket, paraCliente, null)).toBe(false);
  });

  it('recusa qualquer grupo', () => {
    expect(ehDaFonteCerta(socket, mensagem(GRUPO, MECANICO), null)).toBe(false);
  });
});

describe('com grupo escolhido: o grupo, e só ele', () => {
  it('aceita a foto do mecânico, que manda do número dele', () => {
    expect(ehDaFonteCerta(socket, mensagem(GRUPO, MECANICO), GRUPO)).toBe(true);
  });

  it('aceita também a foto que a própria oficina manda no grupo', () => {
    expect(ehDaFonteCerta(socket, mensagem(GRUPO, OFICINA), GRUPO)).toBe(true);
  });

  it('recusa outro grupo qualquer', () => {
    expect(ehDaFonteCerta(socket, mensagem('120363999999999999@g.us', MECANICO), GRUPO)).toBe(false);
  });

  it('o chat consigo mesma deixa de valer — a fonte é trocada, não somada', () => {
    expect(ehDaFonteCerta(socket, mensagem(`${OFICINA}@s.whatsapp.net`), GRUPO)).toBe(false);
  });
});

describe('quem mandou', () => {
  it('no grupo, é o participante', () => {
    expect(remetenteDe(mensagem(GRUPO, MECANICO))).toBe(MECANICO);
  });

  it('no chat consigo mesma, é o próprio número', () => {
    expect(remetenteDe(mensagem(`${OFICINA}@s.whatsapp.net`))).toBe(OFICINA);
  });

  it('ignora o sufixo de aparelho, senão o mesmo mecânico viraria duas pessoas', () => {
    const doTablet = mensagem(GRUPO);
    doTablet.key.participant = `${MECANICO}:47@s.whatsapp.net`;
    expect(remetenteDe(doTablet)).toBe(MECANICO);
  });
});
