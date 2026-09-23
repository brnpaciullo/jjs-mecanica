# JJS Mecânica

Sistema de gestão da **JJS Oficina Mecânica** (Curitiba/PR).

Roda 100% local no notebook da oficina. Não é SaaS, não tem acesso de cliente e
não depende de internet para funcionar — só para enviar WhatsApp e receber
atualizações.

- **Balcão / secretária**: aplicativo desktop (Electron) no notebook.
- **Mecânico**: versão web mobile, aberta no celular pelo Wi-Fi da oficina e
  servida pelo próprio notebook.

> **Etapas 1 a 5 concluídas.** O balcão funciona ponta a ponta: cadastros,
> atendimento, OS com aprovação parcial, quadro por status, **orçamento em PDF
> A5 e impressão**, e **envio pelo WhatsApp**. Falta o app do mecânico (etapa
> 6), mídias pelo WhatsApp (7) e backup/auto-update (8).

---

## Como rodar em desenvolvimento

Desenvolvimento em **Linux**, produção em **Windows 10/11 x64**.

```bash
npm install     # não precisa de compilador: ver nota abaixo
npm run dev     # abre o app
```

> **Módulos nativos.** O `better-sqlite3@13` é Node-API e traz binários prontos
> para cada plataforma (`prebuilds/win32-x64.node`, `linux-x64.node`...). O
> mesmo arquivo serve o Node e o Electron, então **não é preciso Visual Studio
> Build Tools para instalar no Windows**. Se um dia entrar uma dependência
> nativa que não seja Node-API, rode `npm run rebuild:nativos`.
>
> O npm 12 bloqueia scripts de instalação de dependências por padrão. Pode
> deixar bloqueado: o `node-gyp rebuild` do `better-sqlite3` não é necessário
> (os prebuilds resolvem) e o `esbuild` traz o binário por
> `optionalDependencies`.

> **Binário do Electron.** O Electron 44 não tem mais `postinstall` próprio: ele
> baixa o binário só na primeira execução do `cli.js`. Mas o `electron-vite`
> consulta o caminho antes disso e falha com `Error: Electron uninstall`. Por
> isso o `postinstall` da raiz roda `install-electron`, que baixa se faltar e
> sai na hora se já estiver lá. Se ainda assim aparecer esse erro, rode
> `npx install-electron` e tente de novo.

`npm run dev` precisa de sessão gráfica. Rode no terminal do seu desktop, não
numa sessão SSH sem `DISPLAY`.

### Testando de outra máquina (dev por SSH, sem tela)

| Quero                                  | Como                                                                                | O que dá para ver                                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Só olhar a tela, agora                 | `npm run dev:web` e abrir `http://<ip-do-linux>:5173` no navegador da outra máquina | Visual inteiro: cores, fontes, placas, navegação, estados vazios. **Não**: banco, bandeja, janela |
| A janela do Electron de verdade        | `ssh -X` para o Linux + servidor X no Windows (VcXsrv), depois `npm run dev`        | A janela real. **Não**: bandeja (o VcXsrv não tem área de notificação)                            |
| O sistema completo, na plataforma alvo | Copiar o código para o Windows, `npm install`, `npm run dev`                        | Tudo: bandeja, instância única, banco em `%APPDATA%`, e compilação nativa no alvo real            |

`npm run dev:web` sobe só o servidor da tela, sem Electron. A tela avisa em
Configurações que está fora do sistema — o `window.jjs` do preload não existe no
navegador, e isso é dito na cara em vez de falhar em silêncio.

> Não use `electron-vite dev --rendererOnly` para isso: na versão 5.0.0 esse
> flag só pula o rebuild do main e sobe o Electron do mesmo jeito. Por isso o
> `dev:web` chama o Vite direto, com o `vite.renderer.config.ts` que o
> `electron.vite.config.ts` também usa.

Para levar o código para o Windows sem `node_modules` (ele precisa ser
reinstalado lá de qualquer jeito, para compilar os módulos nativos):

```bash
# no Linux
tar --exclude=node_modules --exclude=out --exclude=release \
    -czf /tmp/jjs.tar.gz -C ~/projetos mecanica

# no Windows (PowerShell), puxando do Linux
scp bruno@<ip-do-linux>:/tmp/jjs.tar.gz .
tar -xzf jjs.tar.gz
cd mecanica
npm install
npm run dev
```

### Scripts

| Comando                   | O que faz                                               |
| ------------------------- | ------------------------------------------------------- |
| `npm run dev`             | Abre o app com recarga automática                       |
| `npm run dev:web`         | Só a tela, no navegador, sem Electron (útil por SSH)    |
| `npm run build`           | Compila main, preload e renderer em `apps/desktop/out/` |
| `npm run lint`            | ESLint em todo o monorepo                               |
| `npm run typecheck`       | `tsc --noEmit` em cada workspace                        |
| `npm test`                | Testes unitários (vitest)                               |
| `npm run verificar:fluxo` | Teste de fumaça do fluxo do balcão contra um banco real |
| `npm run db:gerar`        | Gera o SQL da migration depois de mexer no `schema.ts`  |
| `npm run formatar`        | Prettier                                                |

### Onde ficam os dados

Tudo em `app.getPath('userData')` — nunca ao lado do executável, para o
auto-update trocar o programa sem encostar nos dados:

| Sistema     | Pasta                     |
| ----------- | ------------------------- |
| Windows     | `%APPDATA%\jjs-mecanica\` |
| Linux (dev) | `~/.config/jjs-mecanica/` |

Dentro dela: `jjs.db`, `midias/`, `whatsapp-session/`, `backups/`, `pdfs/`,
`logs/`.

Para começar do zero em dev, apague a pasta inteira — na próxima abertura o
banco é recriado e semeado.

---

## Estrutura

```
apps/desktop     Electron: main, preload e a tela do balcão
apps/mobile      App do mecânico (etapa 6)
packages/core    Tipos, validação (zod) e formatação — puro, sem I/O
packages/db      Schema Drizzle, migrations, backup e seed
packages/ui      Tokens de design, fontes e componentes compartilhados
packages/pdf     Template A5 do orçamento (etapa 4)
```

**Toda regra de negócio mora em `packages/core`.** É o que garante que o IPC do
desktop e a API REST do mobile (etapa 6) cheguem no mesmo resultado, sem lógica
duplicada nos dois lados.

### Convenções que não mudam

- **Dinheiro sempre em centavos, inteiro.** Nunca float.
- **Datas em ISO 8601** no banco; `dd/mm/aaaa` na tela.
- **Placa** normalizada (maiúscula, sem hífen); aceita `ABC-1234` e `ABC1D23`.
- **Telefone** em E.164 (`5541999999999`), DDD 41 como padrão.
- **Nada é excluído**, só arquivado.
- Nomes de domínio em português (`Ordem`, `calcularTotais`), nomes de framework
  em inglês (`useEffect`, `handleSubmit`).

### Código específico de Windows

Tudo que só existe no Windows — regra de firewall, início com o sistema,
impressão, abrir pasta no Explorer — fica em `apps/desktop/src/main/platform/`,
atrás da guarda `EH_WINDOWS`. Fora do Windows cada função registra no log e
segue, para o desenvolvimento no Linux não quebrar.

### Mexendo no banco

```bash
# 1. edite packages/db/src/schema.ts
npm run db:gerar     # gera o SQL em packages/db/src/migrations/
# 2. commite o .sql junto com o schema
```

As migrations são aplicadas sozinhas no boot, **sempre depois** de um backup
automático do `.db` (`VACUUM INTO`, que gera uma cópia íntegra num arquivo só).
Se qualquer passo falhar, o app mostra um aviso dizendo onde está o backup e
**não abre com banco pela metade**.

---

## Testes

Dois níveis, por um motivo concreto:

- **`npm test`** — vitest sobre `packages/core`. São as regras puras: dinheiro
  em centavos, placa, telefone, datas e o cálculo de totais com aprovação
  parcial. Rodam em Node puro, rápido, e entram no CI.
- **`npm run verificar:fluxo`** — exercita cliente → carro → OS → itens →
  status → busca contra um **banco SQLite de verdade**, num diretório
  temporário. Precisa rodar sob o runtime do Electron, porque o
  `better-sqlite3` foi compilado para o ABI do Electron e o Node do vitest não
  consegue carregá-lo.

O segundo é o que pega erro de integração de verdade — foi ele que mostrou que
um `ZodError` estava chegando na tela como dump JSON em vez de frase em
português.

---

## Orçamento em PDF (etapa 4)

Um **único template HTML** em `packages/pdf` gera o PDF que vai no WhatsApp e a
impressão em papel. São a mesma coisa de propósito: se fossem dois caminhos,
mais cedo ou mais tarde divergiriam e o cliente receberia um valor diferente do
que foi impresso.

- **A5 retrato**, margens de 8mm, cabendo em **uma folha** num orçamento típico.
- Duas variações: **Orçamento** (antes da aprovação, mostra todos os itens, com
  o recusado riscado) e **Ordem de Serviço** (depois, só os aprovados).
- **Economizar tinta** (padrão): faixa amarela fina no topo em vez de bloco
  preto. Dá para desligar em Configurações.
- **Fallback A4 com 2 vias**: duas cópias lado a lado numa folha deitada, com
  linha de corte, para impressora que não aceita A5.
- As fontes Barlow vão **embutidas** no PDF (`recursos/fontes/*.woff2`), senão o
  documento sairia na fonte padrão do sistema no computador do cliente.

## WhatsApp (etapa 5)

Roda no processo main com [Baileys](https://github.com/WhiskeySockets/Baileys),
sessão persistida em `userData/whatsapp-session`. Uma vez pareado, o celular da
oficina não precisa ler o QR de novo.

**Proteções anti-banimento** — o número da oficina é o canal principal com o
cliente, e perdê-lo é o pior estrago que este sistema poderia causar:

- fila **sequencial**, nunca paralela;
- **3 segundos** no mínimo entre mensagens;
- envio **só por ação humana** — nada automático, nada em massa.

Essas garantias têm teste em `apps/desktop/test/fila.test.ts`.

**Destino resolvido pelo servidor.** O JID **nunca** é montado na mão a partir
do telefone do cadastro. No Brasil muita conta está registrada **sem o nono
dígito**, e o envio para um JID inexistente é aceito sem erro nenhum — a
mensagem só não chega. O sistema pergunta o JID canônico com `onWhatsApp()`
antes de cada envio (`whatsapp/destino.ts`) e avisa quando o número não tem
WhatsApp.

**Plano B:** desconectado, o sistema abre o WhatsApp Web com a mensagem pronta
(`wa.me`) e a pasta do PDF, para arrastar o arquivo na conversa. Fica registrado
como `fallback_link` na tabela `mensagens`. Número inválido **não** cai no plano
B: o link iria para o mesmo número inexistente, então o erro sobe para a tela.

> **Versão do Baileys:** fixada em `7.0.0-rc14`, que é o que os mantenedores
> publicam como `latest` — a linha 6.x está marcada como `legacy`. É um release
> candidate; se aparecer problema de conexão, o caminho é testar
> `@whiskeysockets/baileys@6.7.24`.

---

## Release e auto-update

### Publicando uma versão

O `electron-builder.yml` já aponta para `brnpaciullo/jjs-mecanica` (público), e
por ser público o `electron-updater` lê os releases **sem token embutido** no
instalador.

Para lançar uma versão:

```bash
# 1. suba o número da versão (é ele que o auto-update compara)
npm version patch --workspaces --include-workspace-root --no-git-tag-version

# 2. commite e empurre
git add -A && git commit -m "v0.0.2" && git push

# 3. a tag é o que dispara o build do instalador
git tag v0.0.2 && git push origin v0.0.2
```

O workflow `Release Windows` roda sozinho em `windows-latest`, gera o
`JJS-Mecanica-Setup-0.0.2.exe` e publica no GitHub Releases. O `GITHUB_TOKEN` do
próprio Actions basta — não precisa criar token nenhum.

> **A versão no `package.json` e a tag precisam bater.** O `electron-updater`
> compara a versão instalada com a do release: se a tag for `v0.0.2` mas o
> `package.json` ainda disser `0.0.1`, o app nunca vê a atualização.

> **Rascunho não vale.** O `electron-builder` cria o release como rascunho por
> padrão, e rascunho é invisível para o `electron-updater` — a oficina nunca
> receberia a atualização, e sem erro nenhum na tela. Por isso o
> `electron-builder.yml` fixa `releaseType: release`. Se um release aparecer
> como _Draft_ no GitHub, ele precisa ser publicado na mão para o auto-update
> enxergar.

### Nunca gere o instalador no Linux

`better-sqlite3` — e mais adiante `sharp` e `ffmpeg-static` — são nativos: eles
baixam ou compilam binários **da plataforma onde o `npm install` rodou**. Gerar
o `.exe` a partir do Linux empacotaria binários de Linux dentro do instalador, e
o app quebra no primeiro `require` na máquina da oficina.

O instalador sai **só** do GitHub Actions em `windows-latest`
(`.github/workflows/release.yml`).

### Testar o `.exe` numa VM Windows

Antes de qualquer release que vá para a oficina:

1. Baixe o `JJS-Mecanica-Setup-<versão>.exe` do release (ou do artefato do
   build).
2. Numa VM Windows 10/11 x64 limpa, sem Node e sem ferramenta de
   desenvolvimento — é a única forma de pegar dependência nativa faltando.
3. Confira:
   - o instalador abre, deixa escolher a pasta e cria os atalhos;
   - o app abre e a tela aparece (se o `better-sqlite3` veio errado, quebra logo
     no boot, com erro no `dialog`);
   - `%APPDATA%\jjs-mecanica\` tem `jjs.db` e `logs/jjs.log` com conteúdo;
   - fechar no X manda para a bandeja e o processo continua; **Sair** pelo menu
     da bandeja encerra de verdade;
   - abrir o app duas vezes não cria duas janelas;
   - desinstalar **não** apaga os dados da oficina.
4. Tire um snapshot da VM antes de instalar, para repetir o teste do zero.

---

## Diagnóstico

O log fica em `logs/jjs.log` dentro da pasta de dados, com rotação a 5 MB.
O botão **Exportar diagnóstico** (etapa 8) empacota esse log, sem dados de
clientes.

---

## Etapas

1. ✅ **Fundação** — monorepo, Electron, banco, bandeja, logs, CI/CD
2. ✅ **Cadastros** — configurações, usuários e PIN, clientes, veículos, catálogo, busca `Ctrl+K`
3. ✅ **OS completa no balcão** — recepção, tela da OS, itens, totais, quadro, linha do tempo
4. ✅ **PDF e impressão** — template A5, orçamento e OS, fallback A4 com 2 vias
5. ✅ **WhatsApp** — conexão por QR, envio de orçamento, aviso de pronto, fallback `wa.me`
6. Servidor LAN e app do mecânico — Fastify, pareamento, upload de fotos e vídeos
7. Mídias pelo WhatsApp — captura por legenda, caixa "Mídias sem OS"
8. Backup, restauração e auto-update — instalador final
