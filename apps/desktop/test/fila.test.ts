import { describe, expect, it, vi } from 'vitest';
import { FilaDeEnvio } from '../src/main/whatsapp/fila.js';

/**
 * A fila é a proteção anti-banimento do número da oficina. Se ela deixar
 * passar envio em paralelo ou em rajada, o WhatsApp derruba o número e a
 * oficina fica sem o canal principal com o cliente.
 */
describe('FilaDeEnvio', () => {
  it('respeita o intervalo mínimo entre envios', async () => {
    vi.useFakeTimers();
    const fila = new FilaDeEnvio(3000);
    const momentos: number[] = [];
    const registrar = () => {
      momentos.push(Date.now());
      return Promise.resolve();
    };

    const tudo = Promise.all([
      fila.enfileirar(registrar),
      fila.enfileirar(registrar),
      fila.enfileirar(registrar),
    ]);

    await vi.advanceTimersByTimeAsync(10_000);
    await tudo;
    vi.useRealTimers();

    expect(momentos).toHaveLength(3);
    expect(momentos[1]! - momentos[0]!).toBeGreaterThanOrEqual(3000);
    expect(momentos[2]! - momentos[1]!).toBeGreaterThanOrEqual(3000);
  });

  it('roda uma de cada vez, nunca em paralelo', async () => {
    const fila = new FilaDeEnvio(0);
    let rodando = 0;
    let maximo = 0;

    const tarefa = async () => {
      rodando += 1;
      maximo = Math.max(maximo, rodando);
      await new Promise((r) => setTimeout(r, 5));
      rodando -= 1;
    };

    await Promise.all([1, 2, 3, 4].map(() => fila.enfileirar(tarefa)));
    expect(maximo).toBe(1);
  });

  it('mantém a ordem de chegada', async () => {
    const fila = new FilaDeEnvio(0);
    const saida: number[] = [];
    await Promise.all(
      [1, 2, 3].map((n) =>
        fila.enfileirar(async () => {
          saida.push(n);
        }),
      ),
    );
    expect(saida).toEqual([1, 2, 3]);
  });

  it('entrega o erro a quem chamou sem travar a fila', async () => {
    const fila = new FilaDeEnvio(0);
    const falha = fila.enfileirar(() => Promise.reject(new Error('caiu')));
    const seguinte = fila.enfileirar(() => Promise.resolve('passou'));

    await expect(falha).rejects.toThrow('caiu');
    await expect(seguinte).resolves.toBe('passou');
  });

  it('avisa quantas mensagens estão esperando', async () => {
    const tamanhos: number[] = [];
    const fila = new FilaDeEnvio(0, (t) => tamanhos.push(t));

    await Promise.all([
      fila.enfileirar(() => Promise.resolve()),
      fila.enfileirar(() => Promise.resolve()),
    ]);

    expect(Math.max(...tamanhos)).toBeGreaterThanOrEqual(2);
    expect(tamanhos[tamanhos.length - 1]).toBe(0);
  });
});
