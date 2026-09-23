import { createWriteStream, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ZipArchive } from 'archiver';
import { app, dialog } from 'electron';
import { sql } from 'drizzle-orm';
import { clientes, midias, ordens, veiculos } from '@jjs/db';
import { obterBanco } from './banco.js';
import type { CaminhosApp } from './caminhos.js';
import { log } from './log.js';
import { lerEstadoWhatsApp } from './whatsapp/conexao.js';
import { lerIndice } from './backup/indice.js';

/**
 * Pacote de diagnóstico para mandar a quem cuida do sistema.
 *
 * **Sem nenhum dado de cliente.** Vão os logs e números agregados — quantas OS
 * existem, se o WhatsApp está conectado, quando foi o último backup. Nome,
 * telefone e placa nunca saem da oficina por aqui, porque um zip de suporte
 * costuma acabar num grupo de WhatsApp ou num e-mail qualquer.
 */
function resumo(caminhos: CaminhosApp): string {
  const linhas: string[] = [];
  const escrever = (rotulo: string, valor: unknown) => linhas.push(`${rotulo}: ${String(valor)}`);

  escrever('Gerado em', new Date().toISOString());
  escrever('Versão', app.getVersion());
  escrever('Modo', app.isPackaged ? 'instalado' : 'desenvolvimento');
  escrever('Electron', process.versions.electron);
  escrever('Node', process.versions.node);
  escrever('Plataforma', `${process.platform} ${process.arch}`);
  escrever('Pasta de dados', caminhos.userData);
  linhas.push('');

  try {
    const db = obterBanco();

    const total = (t: typeof clientes | typeof veiculos | typeof ordens | typeof midias) => {
      const [linha] = db
        .select({ n: sql<number>`count(*)` })
        .from(t)
        .all();
      return linha?.n ?? 0;
    };

    linhas.push('-- Volume de dados (só quantidades) --');
    escrever('Clientes', total(clientes));
    escrever('Veículos', total(veiculos));
    escrever('OS', total(ordens));
    escrever('Mídias', total(midias));

    const tamanhoDb = existsSync(caminhos.arquivoDb)
      ? `${Math.round(statSync(caminhos.arquivoDb).size / 1024)} KB`
      : 'não existe';
    escrever('Tamanho do banco', tamanhoDb);
  } catch (erro) {
    linhas.push(`-- Não consegui ler o banco: ${String(erro)} --`);
  }

  linhas.push('');
  linhas.push('-- WhatsApp --');
  const whatsapp = lerEstadoWhatsApp();
  escrever('Situação', whatsapp.situacao);
  escrever('Na fila', whatsapp.naFila);
  // O número conectado é dado da oficina, não de cliente, mas some mesmo assim:
  // não faz falta para diagnóstico.
  escrever('Número conectado', whatsapp.numero ? 'sim' : 'não');

  linhas.push('');
  linhas.push('-- Backup --');
  escrever('Último backup', lerIndice(caminhos.backups).ultimoBackupEm ?? 'nenhum');

  return linhas.join('\n');
}

/** Gera o zip e pergunta onde salvar. Devolve o caminho, ou null se cancelou. */
export async function exportarDiagnostico(caminhos: CaminhosApp): Promise<string | null> {
  const carimbo = new Date().toISOString().replace(/[:.]/g, '-').replace('Z', '');
  const sugestao = `jjs-diagnostico-${carimbo}.zip`;

  const escolha = await dialog.showSaveDialog({
    title: 'Salvar o diagnóstico',
    defaultPath: join(app.getPath('desktop'), sugestao),
    filters: [{ name: 'Diagnóstico', extensions: ['zip'] }],
  });

  if (escolha.canceled || !escolha.filePath) return null;
  const destino = escolha.filePath;

  await new Promise<void>((resolver, rejeitar) => {
    const saida = createWriteStream(destino);
    const zip = new ZipArchive({ zlib: { level: 9 } });

    saida.on('close', () => resolver());
    saida.on('error', rejeitar);
    zip.on('error', rejeitar);

    zip.pipe(saida);
    zip.append(resumo(caminhos), { name: 'resumo.txt' });

    // Só os arquivos de log. Nada de banco, mídia ou sessão do WhatsApp.
    if (existsSync(caminhos.logs)) {
      for (const nome of readdirSync(caminhos.logs)) {
        if (nome.endsWith('.log')) zip.file(join(caminhos.logs, nome), { name: `logs/${nome}` });
      }
    }

    void zip.finalize();
  });

  log.info(`[diagnóstico] gerado em ${destino}`);
  return destino;
}
