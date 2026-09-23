import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Índice do que já foi para o backup.
 *
 * As mídias vão **incrementais**: uma oficina acumula gigabytes de foto e
 * vídeo, e recopiar tudo todo dia encheria o Google Drive e demoraria demais.
 * O índice guarda o que já foi salvo, por caminho e tamanho, para o backup
 * seguinte levar só o que é novo.
 */
export interface IndiceBackup {
  /** caminho relativo -> tamanho em bytes quando foi copiado */
  midias: Record<string, number>;
  ultimoBackupEm: string | null;
}

const VAZIO: IndiceBackup = { midias: {}, ultimoBackupEm: null };

function arquivoDoIndice(pastaBackups: string): string {
  return join(pastaBackups, 'indice-backup.json');
}

export function lerIndice(pastaBackups: string): IndiceBackup {
  const arquivo = arquivoDoIndice(pastaBackups);
  if (!existsSync(arquivo)) return { ...VAZIO };

  try {
    const lido = JSON.parse(readFileSync(arquivo, 'utf8')) as Partial<IndiceBackup>;
    return { midias: lido.midias ?? {}, ultimoBackupEm: lido.ultimoBackupEm ?? null };
  } catch {
    // Índice corrompido não pode impedir o backup: no pior caso ele recopia
    // tudo uma vez, que é bem melhor do que não salvar nada.
    return { ...VAZIO };
  }
}

export function gravarIndice(pastaBackups: string, indice: IndiceBackup): void {
  writeFileSync(arquivoDoIndice(pastaBackups), JSON.stringify(indice, null, 2), 'utf8');
}

/** Faz mais de 24h desde o último backup? */
export function precisaDeBackup(indice: IndiceBackup, agora = new Date()): boolean {
  if (!indice.ultimoBackupEm) return true;

  const ultimo = new Date(indice.ultimoBackupEm).getTime();
  if (Number.isNaN(ultimo)) return true;

  return agora.getTime() - ultimo >= 24 * 60 * 60 * 1000;
}
