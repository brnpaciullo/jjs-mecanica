import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import estatico from '@fastify/static';
import multipart from '@fastify/multipart';
import limite from '@fastify/rate-limit';
import type { CaminhosApp } from '../caminhos.js';
import { log } from '../log.js';
import { descobrirEndereco, PORTA_LAN, type EnderecoDaOficina } from './rede.js';
import { COOKIE_DISPOSITIVO, conferirDispositivo, type SessaoDoCelular } from './sessao.js';
import { registrarRotas } from './rotas.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Quem está do outro lado; preenchido pelo gancho de autenticação. */
    celular?: SessaoDoCelular;
  }
}

let servidor: FastifyInstance | null = null;

export interface EstadoDoServidor extends EnderecoDaOficina {
  rodando: boolean;
  erro: string | null;
}

let estado: EstadoDoServidor = {
  ...descobrirEndereco(),
  rodando: false,
  erro: null,
};

export function lerEstadoDoServidor(): EstadoDoServidor {
  // O IP muda quando o notebook troca de rede; relê sempre.
  return { ...estado, ...descobrirEndereco() };
}

/**
 * Pasta da build do app do mecânico.
 *
 * Procura nos lugares possíveis em vez de confiar num só: instalado ela vem
 * por extraResources, em desenvolvimento sai do workspace, e num script de
 * verificação o `__dirname` é outro. Um caminho errado aqui faz o celular
 * receber 404 sem nenhuma pista do motivo.
 */
function pastaDoMobile(): string | null {
  const candidatos = [
    join(process.resourcesPath, 'mobile'),
    join(__dirname, '..', '..', '..', 'mobile', 'dist'),
    join(process.cwd(), 'apps', 'mobile', 'dist'),
  ];
  return candidatos.find((c) => existsSync(c)) ?? null;
}

/**
 * Sobe o servidor da rede local.
 *
 * Escuta em `0.0.0.0` porque o celular precisa alcançar o notebook pelo Wi-Fi
 * da oficina — `localhost` só serviria a própria máquina. É HTTP puro e sem
 * senha de rede: a proteção é o cookie de dispositivo pareado por QR mais o
 * PIN, e o fato de estar numa rede privada. Não expor essa porta para a
 * internet.
 */
export async function iniciarServidorLan(caminhos: CaminhosApp): Promise<EstadoDoServidor> {
  if (servidor) return lerEstadoDoServidor();

  const fastify = Fastify({ logger: false, bodyLimit: 1024 * 1024 });

  await fastify.register(cookie);
  await fastify.register(multipart, {
    // Vídeo de 60s de celular passa fácil de 100 MB.
    limits: { fileSize: 500 * 1024 * 1024, files: 1 },
  });

  // Limite global folgado; o PIN tem um limite próprio, bem mais apertado.
  await fastify.register(limite, {
    max: 300,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.ip,
  });

  /**
   * Toda rota exige dispositivo pareado, menos as exceções abaixo.
   * O PIN é exigido pelas rotas de dados; o gancho só resolve quem é.
   */
  fastify.addHook('onRequest', async (req: FastifyRequest, resposta: FastifyReply) => {
    const caminho = req.url.split('?')[0] ?? '';

    const publico =
      caminho === '/parear' ||
      caminho === '/api/saude' ||
      caminho === '/' ||
      caminho.startsWith('/assets/') ||
      caminho.endsWith('.js') ||
      caminho.endsWith('.css') ||
      caminho.endsWith('.woff2') ||
      caminho.endsWith('.svg') ||
      caminho.endsWith('.png') ||
      caminho === '/manifest.webmanifest';

    if (publico) return;

    const segredo = req.cookies[COOKIE_DISPOSITIVO];
    const celular = conferirDispositivo(segredo);

    if (!celular) {
      await resposta.code(401).send({
        erro: 'nao_pareado',
        mensagem:
          'Este celular não está conectado ao sistema da oficina. ' +
          'Peça para lerem o QR code no computador do balcão.',
      });
      return;
    }

    req.celular = celular;
  });

  // As fotos são de cliente: só celular pareado vê.
  await fastify.register(estatico, {
    root: caminhos.midias,
    prefix: '/midias/',
    decorateReply: false,
  });

  await registrarRotas(fastify, caminhos);

  // A tela do mecânico por último: ela responde tudo que sobrou.
  const mobile = pastaDoMobile();
  if (mobile) {
    log.info(`[lan] servindo o app do mecânico de ${mobile}`);
    await fastify.register(estatico, { root: mobile, prefix: '/' });
    fastify.setNotFoundHandler((req, resposta) => {
      // Rota de API inexistente é erro; o resto é caminho do app e volta o index.
      if (req.url.startsWith('/api/')) {
        return resposta.code(404).send({ erro: 'nao_encontrado' });
      }
      return resposta.sendFile('index.html');
    });
  } else {
    log.warn(
      '[lan] build do app do mecânico não encontrada. Rode `npm run build` antes de empacotar.',
    );
  }

  try {
    await fastify.listen({ port: PORTA_LAN, host: '0.0.0.0' });
    servidor = fastify;
    estado = { ...descobrirEndereco(), rodando: true, erro: null };
    log.info(`[lan] servidor no ar em ${estado.url ?? `porta ${PORTA_LAN}`}`);
  } catch (erro) {
    const ocupada = (erro as { code?: string }).code === 'EADDRINUSE';
    estado = {
      ...descobrirEndereco(),
      rodando: false,
      erro: ocupada
        ? `A porta ${PORTA_LAN} já está em uso por outro programa. Feche-o e abra o sistema de novo.`
        : 'Não consegui abrir o acesso para o celular do mecânico.',
    };
    log.error('[lan] falhou ao subir o servidor', erro);
  }

  return lerEstadoDoServidor();
}

export async function pararServidorLan(): Promise<void> {
  if (!servidor) return;
  await servidor.close();
  servidor = null;
  estado = { ...estado, rodando: false };
  log.info('[lan] servidor encerrado');
}
