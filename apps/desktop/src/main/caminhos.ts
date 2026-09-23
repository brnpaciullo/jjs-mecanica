import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

/**
 * Tudo que e dado da oficina mora em userData. Nada fica ao lado do .exe:
 * assim o auto-update troca o programa sem encostar no banco nem nas fotos.
 * Sempre path.join, nunca barra fixa.
 */
export interface CaminhosApp {
  userData: string;
  arquivoDb: string;
  midias: string;
  midiasInbox: string;
  whatsappSession: string;
  backups: string;
  pdfs: string;
  logs: string;
  migrations: string;
}

/**
 * Migrations: em dev vem do workspace; empacotado vem de resources/migrations
 * (extraResources no electron-builder.yml). O asar nao serve como pasta para o
 * migrator, por isso ela fica fora do bundle.
 */
function pastaMigrations(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'migrations')
    : join(__dirname, '..', '..', '..', '..', 'packages', 'db', 'src', 'migrations');
}

export function montarCaminhos(): CaminhosApp {
  const userData = app.getPath('userData');
  const midias = join(userData, 'midias');

  return {
    userData,
    arquivoDb: join(userData, 'jjs.db'),
    midias,
    midiasInbox: join(midias, '_inbox'),
    whatsappSession: join(userData, 'whatsapp-session'),
    backups: join(userData, 'backups'),
    pdfs: join(userData, 'pdfs'),
    logs: join(userData, 'logs'),
    migrations: pastaMigrations(),
  };
}

/** Cria as pastas no boot para nenhum modulo precisar se preocupar com isso. */
export function garantirPastas(caminhos: CaminhosApp): void {
  for (const pasta of [
    caminhos.midias,
    caminhos.midiasInbox,
    caminhos.whatsappSession,
    caminhos.backups,
    caminhos.pdfs,
    caminhos.logs,
  ]) {
    mkdirSync(pasta, { recursive: true });
  }
}
