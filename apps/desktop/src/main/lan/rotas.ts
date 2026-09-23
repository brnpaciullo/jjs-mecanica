import { createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { COMBUSTIVEL, STATUS_ORDEM, TIPOS_ITEM } from '@jjs/core';
import {
  ErroDeNegocio,
  reposCatalogo,
  reposClientes,
  reposEventos,
  reposItens,
  reposOrdens,
  reposVeiculos,
  type Contexto,
} from '@jjs/db';
import { obterBanco } from '../banco.js';
import type { CaminhosApp } from '../caminhos.js';
import { log } from '../log.js';
import { listarMidias } from '../midias/consultar.js';
import { salvarFoto, salvarVideo } from '../midias/processar.js';
import {
  COOKIE_DISPOSITIVO,
  VALIDADE_COOKIE_MS,
  conferirPin,
  parearDispositivo,
  registrarEntradaComPin,
} from './sessao.js';

/** Mensagem de erro que pode ir para a tela do celular. */
function mensagem(erro: unknown): string {
  if (erro instanceof ErroDeNegocio) return erro.message;
  if (erro instanceof z.ZodError) return erro.issues[0]?.message ?? 'Confira os dados.';
  if (erro instanceof Error && erro.message) return erro.message;
  return 'Algo deu errado. Tente de novo.';
}

export async function registrarRotas(app: FastifyInstance, caminhos: CaminhosApp): Promise<void> {
  /** Contexto dos repositórios, com a autoria do mecânico que entrou. */
  const ctx = (usuarioId: number | null): Contexto => ({ db: obterBanco(), usuarioId });

  /**
   * Toda rota de dados exige o PIN conferido, não só o celular pareado.
   * Devolve o id de quem entrou — é ele que assina o que for feito — ou null
   * quando já respondeu 403.
   */
  const exigirPin = async (req: FastifyRequest, resposta: FastifyReply): Promise<number | null> => {
    if (!req.celular?.usuarioId) {
      await resposta
        .code(403)
        .send({ erro: 'sem_pin', mensagem: 'Digite seu PIN para continuar.' });
      return null;
    }
    return req.celular.usuarioId;
  };

  // ------------------------------------------------------------------ saúde
  // Usada pelo celular para dizer "não achei o computador da oficina".
  app.get('/api/saude', async () => ({ ok: true, sistema: 'JJS Mecânica' }));

  // -------------------------------------------------------------- pareamento
  app.get('/parear', async (req, resposta) => {
    const { token } = (req.query ?? {}) as { token?: string };

    if (!token) {
      return resposta
        .code(400)
        .type('text/html; charset=utf-8')
        .send(paginaSimples('Link incompleto', 'Leia o QR code de novo no computador da oficina.'));
    }

    try {
      const pareado = parearDispositivo(token, 'Celular do mecânico');

      resposta.setCookie(COOKIE_DISPOSITIVO, pareado.segredo, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: Math.floor(VALIDADE_COOKIE_MS / 1000),
      });

      // Redireciona para a raiz: daqui em diante o app pede só o PIN.
      return resposta.redirect('/');
    } catch (erro) {
      log.warn('[lan] pareamento recusado', erro);
      return resposta
        .code(400)
        .type('text/html; charset=utf-8')
        .send(paginaSimples('Não consegui conectar', mensagem(erro)));
    }
  });

  // --------------------------------------------------------------------- PIN
  app.post(
    '/api/entrar',
    {
      // Limite apertado: PIN de 4 dígitos é curto, e é isto que impede
      // alguém de tentar os 10 mil em sequência.
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (req, resposta) => {
      const corpo = z.object({ pin: z.string() }).safeParse(req.body);
      if (!corpo.success) return resposta.code(400).send({ mensagem: 'Digite o PIN.' });

      const usuario = conferirPin(corpo.data.pin);
      if (!usuario) {
        log.warn(`[lan] PIN errado no dispositivo ${req.celular?.dispositivoId}`);
        return resposta.code(401).send({ mensagem: 'PIN errado. Tente de novo.' });
      }

      registrarEntradaComPin(req.celular!.dispositivoId, usuario.id);
      return { usuario: { id: usuario.id, nome: usuario.nome } };
    },
  );

  app.get('/api/eu', async (req) => ({
    dispositivo: req.celular?.nome ?? null,
    usuarioId: req.celular?.usuarioId ?? null,
    precisaDePin: !req.celular?.usuarioId,
  }));

  // ------------------------------------------------------------------ quadro
  app.get('/api/quadro', async (req, resposta) => {
    const usuarioId = await exigirPin(req, resposta);
    if (usuarioId === null) return;
    return reposOrdens.listarQuadro(ctx(usuarioId));
  });

  // ---------------------------------------------------------------------- OS
  app.get('/api/os/:id', async (req, resposta) => {
    const usuarioId = await exigirPin(req, resposta);
    if (usuarioId === null) return;

    const id = Number((req.params as { id: string }).id);
    const contexto = ctx(usuarioId);
    const ordem = reposOrdens.buscarOrdem(contexto, id);
    if (!ordem) return resposta.code(404).send({ mensagem: 'Essa OS não foi encontrada.' });

    return {
      ordem,
      detalhe: reposOrdens.detalharOrdem(contexto, id),
      itens: reposItens.listarItens(contexto, id),
      totais: reposItens.totaisDaOrdem(contexto, id),
      eventos: reposEventos.listarEventos(contexto, id),
      midias: listarMidias(contexto, id),
    };
  });

  app.patch('/api/os/:id', async (req, resposta) => {
    const usuarioId = await exigirPin(req, resposta);
    if (usuarioId === null) return;

    const id = Number((req.params as { id: string }).id);
    const corpo = z
      .object({
        queixas: z.string().optional(),
        diagnostico: z.string().nullable().optional(),
        descontoCentavos: z.number().int().optional(),
        prazoEstimado: z.string().nullable().optional(),
      })
      .safeParse(req.body);

    if (!corpo.success) return resposta.code(400).send({ mensagem: 'Confira os dados.' });

    try {
      return reposOrdens.atualizarOrdem(ctx(usuarioId), id, corpo.data);
    } catch (erro) {
      return resposta.code(400).send({ mensagem: mensagem(erro) });
    }
  });

  app.post('/api/os/:id/status', async (req, resposta) => {
    const usuarioId = await exigirPin(req, resposta);
    if (usuarioId === null) return;

    const id = Number((req.params as { id: string }).id);
    const corpo = z.object({ status: z.enum(STATUS_ORDEM) }).safeParse(req.body);
    if (!corpo.success) return resposta.code(400).send({ mensagem: 'Situação inválida.' });

    try {
      return reposOrdens.mudarStatus(ctx(usuarioId), id, corpo.data.status);
    } catch (erro) {
      return resposta.code(400).send({ mensagem: mensagem(erro) });
    }
  });

  // ------------------------------------------------------------------- itens
  app.post('/api/os/:id/itens', async (req, resposta) => {
    const usuarioId = await exigirPin(req, resposta);
    if (usuarioId === null) return;

    const id = Number((req.params as { id: string }).id);
    const corpo = z
      .object({
        tipo: z.enum(TIPOS_ITEM),
        descricao: z.string(),
        quantidade: z.number().positive().default(1),
        valorUnitarioCentavos: z.number().int().min(0),
        observacao: z.string().nullable().optional(),
      })
      .safeParse(req.body);

    if (!corpo.success) return resposta.code(400).send({ mensagem: mensagem(corpo.error) });

    try {
      return reposItens.adicionarItem(ctx(usuarioId), id, corpo.data);
    } catch (erro) {
      return resposta.code(400).send({ mensagem: mensagem(erro) });
    }
  });

  app.patch('/api/itens/:id', async (req, resposta) => {
    const usuarioId = await exigirPin(req, resposta);
    if (usuarioId === null) return;

    const id = Number((req.params as { id: string }).id);
    const corpo = z
      .object({
        descricao: z.string().optional(),
        quantidade: z.number().positive().optional(),
        valorUnitarioCentavos: z.number().int().min(0).optional(),
        observacao: z.string().nullable().optional(),
        aprovado: z.boolean().optional(),
      })
      .safeParse(req.body);

    if (!corpo.success) return resposta.code(400).send({ mensagem: 'Confira os dados.' });

    try {
      return reposItens.atualizarItem(ctx(usuarioId), id, corpo.data);
    } catch (erro) {
      return resposta.code(400).send({ mensagem: mensagem(erro) });
    }
  });

  app.delete('/api/itens/:id', async (req, resposta) => {
    const usuarioId = await exigirPin(req, resposta);
    if (usuarioId === null) return;

    try {
      reposItens.removerItem(ctx(usuarioId), Number((req.params as { id: string }).id));
      return { removido: true };
    } catch (erro) {
      return resposta.code(400).send({ mensagem: mensagem(erro) });
    }
  });

  // -------------------------------------------------------------- catálogo
  app.get('/api/catalogo', async (req, resposta) => {
    const usuarioId = await exigirPin(req, resposta);
    if (usuarioId === null) return;
    const { termo } = (req.query ?? {}) as { termo?: string };
    return reposCatalogo.sugerirCatalogo(ctx(usuarioId), termo ?? '');
  });

  // ------------------------------------------------------- abrir atendimento
  app.get('/api/buscar', async (req, resposta) => {
    const usuarioId = await exigirPin(req, resposta);
    if (usuarioId === null) return;

    const { termo } = (req.query ?? {}) as { termo?: string };
    const contexto = ctx(usuarioId);
    return {
      clientes: reposClientes.listarClientes(contexto, termo ?? '').slice(0, 8),
      veiculos: reposVeiculos.listarVeiculos(contexto, termo ?? '').slice(0, 8),
    };
  });

  app.post('/api/atendimento', async (req, resposta) => {
    const usuarioId = await exigirPin(req, resposta);
    if (usuarioId === null) return;

    const corpo = z
      .object({
        clienteId: z.number().int().positive().nullable().optional(),
        clienteNome: z.string().optional(),
        clienteTelefone: z.string().optional(),
        veiculoId: z.number().int().positive().nullable().optional(),
        placa: z.string().optional(),
        marca: z.string().optional(),
        modelo: z.string().optional(),
        queixas: z.string(),
        kmEntrada: z.number().int().nullable().optional(),
        combustivel: z.enum(COMBUSTIVEL).nullable().optional(),
      })
      .safeParse(req.body);

    if (!corpo.success) return resposta.code(400).send({ mensagem: mensagem(corpo.error) });
    const dados = corpo.data;
    const contexto = ctx(usuarioId);

    try {
      // Cliente e carro podem vir prontos ou ser criados na hora — no celular
      // o mecânico não vai navegar por telas de cadastro.
      const clienteId =
        dados.clienteId ??
        reposClientes.criarCliente(contexto, {
          nome: dados.clienteNome ?? '',
          telefone: dados.clienteTelefone ?? '',
        }).id;

      const veiculoId =
        dados.veiculoId ??
        reposVeiculos.criarVeiculo(contexto, {
          clienteId,
          marca: dados.marca ?? '',
          modelo: dados.modelo ?? '',
          placa: dados.placa ?? '',
        }).id;

      return reposOrdens.criarOrdem(contexto, {
        clienteId,
        veiculoId,
        queixas: dados.queixas,
        kmEntrada: dados.kmEntrada ?? null,
        combustivel: dados.combustivel ?? null,
      });
    } catch (erro) {
      return resposta.code(400).send({ mensagem: mensagem(erro) });
    }
  });

  // ------------------------------------------------------------------ mídias
  app.get('/api/os/:id/midias', async (req, resposta) => {
    const usuarioId = await exigirPin(req, resposta);
    if (usuarioId === null) return;
    return listarMidias(ctx(usuarioId), Number((req.params as { id: string }).id));
  });

  /**
   * Upload de foto ou vídeo.
   *
   * Vem como multipart porque é arquivo grande; os campos extras (momento,
   * legenda) vêm junto no mesmo envio para o celular não precisar de duas
   * requisições — em Wi-Fi ruim, cada ida e volta é uma chance de falhar.
   */
  app.post('/api/os/:id/midias', async (req, resposta) => {
    const usuarioId = await exigirPin(req, resposta);
    if (usuarioId === null) return;

    const ordemId = Number((req.params as { id: string }).id);
    const arquivo = await req.file();
    if (!arquivo) return resposta.code(400).send({ mensagem: 'Nenhum arquivo foi enviado.' });

    const campo = (nome: string): string | undefined => {
      const valor = (arquivo.fields as Record<string, unknown>)[nome];
      return valor && typeof valor === 'object' && 'value' in valor
        ? String((valor as { value: unknown }).value)
        : undefined;
    };

    const momentoBruto = campo('momento');
    const momento = (['entrada', 'diagnostico', 'servico'] as const).includes(
      momentoBruto as 'entrada',
    )
      ? (momentoBruto as 'entrada' | 'diagnostico' | 'servico')
      : 'servico';

    const legenda = campo('legenda') ?? null;
    const itemIdBruto = campo('itemId');
    const itemId = itemIdBruto ? Number(itemIdBruto) : null;

    try {
      const ehVideo = (arquivo.mimetype ?? '').startsWith('video/');

      if (ehVideo) {
        // Vídeo vai para o disco em pedaços: carregar 200 MB na memória
        // derrubaria o processo principal.
        const temporario = join(tmpdir(), `jjs-upload-${Date.now()}`);
        await pipeline(arquivo.file, createWriteStream(temporario));

        const salva = await salvarVideo(caminhos, ordemId, temporario, {
          momento,
          itemId,
          legenda,
          criadoPor: usuarioId,
        });
        return salva;
      }

      const bytes = await arquivo.toBuffer();
      return await salvarFoto(caminhos, ordemId, bytes, {
        momento,
        itemId,
        legenda,
        criadoPor: usuarioId,
      });
    } catch (erro) {
      log.error('[lan] falhou ao receber a mídia', erro);
      return resposta.code(400).send({ mensagem: mensagem(erro) });
    }
  });
}

/** Página mínima para o pareamento, que acontece fora do app React. */
function paginaSimples(titulo: string, texto: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo}</title>
<style>
 body{font-family:system-ui,sans-serif;background:#15171B;color:#fff;margin:0;
      display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
 div{max-width:32rem}
 h1{color:#F2B705;font-size:1.6rem;margin:0 0 .75rem}
 p{font-size:1.15rem;line-height:1.5;margin:0}
</style></head><body><div><h1>${titulo}</h1><p>${texto}</p></div></body></html>`;
}
