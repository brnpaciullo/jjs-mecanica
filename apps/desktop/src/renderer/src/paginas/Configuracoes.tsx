import { useState, type ReactNode } from 'react';
import { ImagePlus, KeyRound, Plus, Save } from 'lucide-react';
import { PAPEIS, type Papel } from '@jjs/core';
import type { ConfigRegistro, UsuarioRegistro } from '@jjs/db';
import { Botao, Campo } from '@jjs/ui';
import { Pagina } from '../componentes/Pagina.js';
import { Dialogo } from '../componentes/Dialogo.js';
import { Aviso } from '../componentes/Aviso.js';
import { CartaoWhatsApp } from '../componentes/CartaoWhatsApp.js';
import { CartaoCelular } from '../componentes/CartaoCelular.js';
import { CartaoBackup } from '../componentes/CartaoBackup.js';
import { CartaoAtualizacao } from '../componentes/CartaoAtualizacao.js';
import { CartaoDiagnostico } from '../componentes/CartaoDiagnostico.js';
import { useConsulta } from '../hooks/useConsulta.js';
import { temPonte, useInfoApp } from '../hooks/useInfoApp.js';
import { mensagemDeErro } from '../erro.js';

const ROTULO_PAPEL: Record<Papel, string> = {
  admin: 'Dono (tudo liberado)',
  balcao: 'Balcão',
  mecanico: 'Mecânico',
};

function Cartao({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-card border border-jjs-borda bg-jjs-branco p-5">
      <h2 className="font-titulo text-2xl text-jjs-preto">{titulo}</h2>
      {descricao ? <p className="mt-1 text-jjs-texto-fraco">{descricao}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Configuracoes() {
  const info = useInfoApp();
  const noNavegador = !temPonte();

  return (
    <Pagina titulo="Configurações">
      <div className="grid gap-4">
        {noNavegador ? (
          <Aviso tom="info">
            Esta tela está aberta no navegador, fora do sistema. Dá para conferir o visual, mas nada
            aqui está ligado no banco da oficina.
          </Aviso>
        ) : (
          <>
            <DadosDaOficina />
            <CartaoWhatsApp />
            <CartaoCelular />
            <Textos />
            <Usuarios />
            <CartaoBackup />
            <CartaoAtualizacao />
            <CartaoDiagnostico />
          </>
        )}

        <Cartao
          titulo="Onde ficam os dados da oficina"
          descricao="O banco, as fotos e os backups ficam nesta pasta. O sistema pode ser atualizado sem encostar nela."
        >
          <p className="break-all font-mono text-sm text-jjs-preto">
            {info?.pastaDados ?? (noNavegador ? '— só aparece dentro do sistema' : 'Carregando...')}
          </p>
        </Cartao>
      </div>

      <footer className="mt-2 flex items-center justify-between border-t border-jjs-borda pt-4 text-sm text-jjs-texto-fraco">
        <span>
          JJS Mecânica {info ? `versão ${info.versao}` : ''}
          {info && !info.ehWindows ? ' · modo desenvolvimento' : ''}
          {noNavegador ? 'pré-visualização no navegador' : ''}
        </span>
      </footer>
    </Pagina>
  );
}

function DadosDaOficina() {
  const { dados, erro, recarregar } = useConsulta<ConfigRegistro>(
    () => window.jjs.config.ler(),
    [],
  );
  const [salvo, setSalvo] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Partial<ConfigRegistro>>({});

  if (erro) return <Aviso tom="erro">{erro}</Aviso>;
  if (!dados) return <Cartao titulo="Dados da oficina">Carregando...</Cartao>;

  const valor = <C extends keyof ConfigRegistro>(campo: C): ConfigRegistro[C] =>
    (rascunho[campo] ?? dados[campo]) as ConfigRegistro[C];

  const mudar = (campo: keyof ConfigRegistro, v: unknown) => {
    setRascunho((r) => ({ ...r, [campo]: v }));
    setSalvo(false);
  };

  async function salvar() {
    try {
      await window.jjs.config.salvar(rascunho);
      setRascunho({});
      setErroSalvar(null);
      setSalvo(true);
      recarregar();
    } catch (causa) {
      setErroSalvar(mensagemDeErro(causa));
    }
  }

  return (
    <Cartao titulo="Dados da oficina" descricao="Aparecem no cabeçalho do orçamento impresso.">
      <div className="flex flex-col gap-4">
        {erroSalvar ? <Aviso tom="erro">{erroSalvar}</Aviso> : null}

        <Campo
          rotulo="Nome da oficina"
          value={String(valor('nome') ?? '')}
          onChange={(e) => mudar('nome', e.target.value)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            rotulo="CNPJ"
            value={String(valor('cnpj') ?? '')}
            onChange={(e) => mudar('cnpj', e.target.value)}
          />
          <Campo
            rotulo="Telefone"
            value={String(valor('telefone') ?? '')}
            onChange={(e) => mudar('telefone', e.target.value)}
          />
        </div>

        <Campo
          rotulo="Endereço"
          value={String(valor('endereco') ?? '')}
          onChange={(e) => mudar('endereco', e.target.value)}
        />

        <Logo logoPath={dados.logoPath} aoMudar={recarregar} />

        <Campo
          rotulo="Validade do orçamento (dias)"
          type="number"
          min={1}
          max={365}
          value={String(valor('validadeOrcamentoDias') ?? 7)}
          onChange={(e) => mudar('validadeOrcamentoDias', Number(e.target.value))}
          ajuda="Contados a partir do envio do orçamento ao cliente."
        />

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={Boolean(valor('economizarTinta'))}
            onChange={(e) => mudar('economizarTinta', e.target.checked)}
            className="size-5"
          />
          <span>Economizar tinta na impressão (faixa amarela fina no lugar do bloco preto)</span>
        </label>

        <div className="flex items-center justify-end gap-3">
          {salvo ? <span className="text-sm text-jjs-verde">Salvo</span> : null}
          <Botao
            variante="principal"
            icone={<Save size={18} />}
            onClick={() => void salvar()}
            disabled={Object.keys(rascunho).length === 0}
          >
            Salvar dados
          </Botao>
        </div>
      </div>
    </Cartao>
  );
}

/**
 * O logo entra no cabeçalho do orçamento impresso. A imagem é copiada para a
 * pasta de dados do sistema, e não referenciada onde ela está hoje: se ficasse
 * apontando para a Área de Trabalho, bastaria mover o arquivo para o cabeçalho
 * sumir — e o backup não levaria a imagem junto.
 */
function Logo({ logoPath, aoMudar }: { logoPath: string | null; aoMudar: () => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function executar(acao: () => Promise<unknown>) {
    setOcupado(true);
    setErro(null);
    try {
      await acao();
      aoMudar();
    } catch (causa) {
      setErro(mensagemDeErro(causa));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-jjs-preto">Logo da oficina</span>
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      <div className="flex flex-wrap items-center gap-4">
        {logoPath ? (
          <img
            src={`file://${logoPath}`}
            alt="Logo da oficina"
            className="h-16 max-w-40 rounded-campo border border-jjs-borda bg-white object-contain p-1"
          />
        ) : (
          <span className="flex h-16 w-40 items-center justify-center rounded-campo border border-dashed border-jjs-borda text-sm text-jjs-texto-fraco">
            Sem logo
          </span>
        )}

        <Botao
          variante="secundario"
          icone={<ImagePlus size={18} />}
          disabled={ocupado}
          onClick={() => void executar(() => window.jjs.logo.escolher())}
        >
          {logoPath ? 'Trocar logo' : 'Escolher logo'}
        </Botao>

        {logoPath ? (
          <Botao
            variante="discreto"
            className="text-jjs-vermelho"
            disabled={ocupado}
            onClick={() => void executar(() => window.jjs.logo.remover())}
          >
            Remover
          </Botao>
        ) : null}
      </div>

      <p className="text-sm text-jjs-texto-fraco">
        PNG, JPG ou WEBP de até 5 MB. Aparece no cabeçalho do orçamento impresso.
      </p>
    </div>
  );
}

function Textos() {
  const { dados, recarregar } = useConsulta<ConfigRegistro>(() => window.jjs.config.ler(), []);
  const [rascunho, setRascunho] = useState<Partial<ConfigRegistro>>({});
  const [salvo, setSalvo] = useState(false);

  if (!dados) return null;

  const valor = (campo: keyof ConfigRegistro): string =>
    String(rascunho[campo] ?? dados[campo] ?? '');

  const mudar = (campo: keyof ConfigRegistro, v: string) => {
    setRascunho((r) => ({ ...r, [campo]: v }));
    setSalvo(false);
  };

  async function salvar() {
    await window.jjs.config.salvar(rascunho);
    setRascunho({});
    setSalvo(true);
    recarregar();
  }

  return (
    <Cartao titulo="Textos" descricao="Garantia, rodapé do orçamento e modelos de mensagem.">
      <div className="flex flex-col gap-4">
        <AreaTexto campo="textoGarantia" rotulo="Texto de garantia" valor={valor} mudar={mudar} />
        <AreaTexto
          campo="mensagemRodapePdf"
          rotulo="Rodapé do orçamento impresso"
          valor={valor}
          mudar={mudar}
        />
        <AreaTexto
          campo="templateMsgRecebimento"
          rotulo="Mensagem ao receber o carro"
          dica="Variáveis: {cliente} {veiculo} {placa} {numero_os} — sem {total}, aqui ainda não há preço"
          valor={valor}
          mudar={mudar}
        />
        <AreaTexto
          campo="templateMsgOrcamento"
          rotulo="Mensagem ao enviar o orçamento"
          dica="Variáveis: {cliente} {veiculo} {placa} {numero_os} {total}"
          valor={valor}
          mudar={mudar}
        />
        <AreaTexto
          campo="templateMsgPronto"
          rotulo="Mensagem de carro pronto"
          dica="Variáveis: {cliente} {veiculo} {placa} {numero_os} {total}"
          valor={valor}
          mudar={mudar}
        />

        <div className="flex items-center justify-end gap-3">
          {salvo ? <span className="text-sm text-jjs-verde">Salvo</span> : null}
          <Botao
            variante="principal"
            icone={<Save size={18} />}
            onClick={() => void salvar()}
            disabled={Object.keys(rascunho).length === 0}
          >
            Salvar textos
          </Botao>
        </div>
      </div>
    </Cartao>
  );
}

/**
 * Precisa ser um componente de módulo, não uma função criada dentro do render:
 * o React remontaria o textarea a cada tecla e o cursor pularia para o fim.
 */
function AreaTexto({
  campo,
  rotulo,
  dica,
  valor,
  mudar,
}: {
  campo: keyof ConfigRegistro;
  rotulo: string;
  dica?: string;
  valor: (campo: keyof ConfigRegistro) => string;
  mudar: (campo: keyof ConfigRegistro, v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`txt-${String(campo)}`} className="text-sm font-semibold text-jjs-preto">
        {rotulo}
      </label>
      <textarea
        id={`txt-${String(campo)}`}
        value={valor(campo)}
        onChange={(e) => mudar(campo, e.target.value)}
        rows={4}
        className="rounded-campo border border-jjs-borda bg-jjs-branco p-3"
      />
      {dica ? <p className="text-sm text-jjs-texto-fraco">{dica}</p> : null}
    </div>
  );
}

function Usuarios() {
  const { dados, recarregar } = useConsulta<UsuarioRegistro[]>(
    () => window.jjs.usuarios.listar(),
    [],
  );
  const [novo, setNovo] = useState(false);
  const [pinDe, setPinDe] = useState<UsuarioRegistro | null>(null);

  return (
    <Cartao
      titulo="Usuários"
      descricao="O notebook do balcão não pede login. O PIN é para o celular do mecânico."
    >
      <ul className="divide-y divide-jjs-borda rounded-card border border-jjs-borda">
        {(dados ?? []).map((usuario) => (
          <li key={usuario.id} className="flex min-h-toque items-center gap-3 px-4 py-2.5">
            <span className="flex-1 font-medium">{usuario.nome}</span>
            <span className="text-sm text-jjs-texto-fraco">{ROTULO_PAPEL[usuario.papel]}</span>
            <span className="text-sm text-jjs-texto-fraco">
              {usuario.pinHash ? 'PIN cadastrado' : 'sem PIN'}
            </span>
            <Botao
              variante="secundario"
              className="min-h-10"
              icone={<KeyRound size={16} />}
              onClick={() => setPinDe(usuario)}
            >
              PIN
            </Botao>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex justify-end">
        <Botao variante="secundario" icone={<Plus size={18} />} onClick={() => setNovo(true)}>
          Novo usuário
        </Botao>
      </div>

      <Dialogo titulo="Novo usuário" aberto={novo} aoFechar={() => setNovo(false)}>
        <FormularioUsuario
          aoCancelar={() => setNovo(false)}
          aoSalvar={() => {
            setNovo(false);
            recarregar();
          }}
        />
      </Dialogo>

      <Dialogo
        titulo={pinDe ? `PIN de ${pinDe.nome}` : 'PIN'}
        aberto={pinDe !== null}
        aoFechar={() => setPinDe(null)}
      >
        {pinDe ? (
          <FormularioPin
            usuario={pinDe}
            aoCancelar={() => setPinDe(null)}
            aoSalvar={() => {
              setPinDe(null);
              recarregar();
            }}
          />
        ) : null}
      </Dialogo>
    </Cartao>
  );
}

function FormularioUsuario({
  aoSalvar,
  aoCancelar,
}: {
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const [nome, setNome] = useState('');
  const [papel, setPapel] = useState<Papel>('mecanico');
  const [pin, setPin] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    try {
      await window.jjs.usuarios.criar({ nome, papel, pin: pin || null });
      aoSalvar();
    } catch (causa) {
      setErro(mensagemDeErro(causa));
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
    >
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      <Campo
        rotulo="Nome"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        autoFocus
        required
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="papel-novo" className="text-sm font-semibold text-jjs-preto">
          Função
        </label>
        <select
          id="papel-novo"
          value={papel}
          onChange={(e) => setPapel(e.target.value as Papel)}
          className="min-h-toque rounded-campo border border-jjs-borda bg-jjs-branco px-3"
        >
          {PAPEIS.map((p) => (
            <option key={p} value={p}>
              {ROTULO_PAPEL[p]}
            </option>
          ))}
        </select>
      </div>

      <Campo
        rotulo="PIN do celular (opcional)"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        placeholder="4 a 6 números"
        ajuda="Só é usado para entrar pelo celular. Pode ficar em branco agora."
      />

      <div className="flex justify-end gap-3">
        <Botao variante="secundario" onClick={aoCancelar}>
          Cancelar
        </Botao>
        <Botao type="submit" variante="principal">
          Cadastrar
        </Botao>
      </div>
    </form>
  );
}

function FormularioPin({
  usuario,
  aoSalvar,
  aoCancelar,
}: {
  usuario: UsuarioRegistro;
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const [pin, setPin] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(valor: string | null) {
    try {
      await window.jjs.usuarios.atualizar({ id: usuario.id, pin: valor });
      aoSalvar();
    } catch (causa) {
      setErro(mensagemDeErro(causa));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      <Campo
        rotulo="Novo PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        placeholder="4 a 6 números"
        autoFocus
      />

      <div className="flex justify-between gap-3">
        {usuario.pinHash ? (
          <Botao variante="perigo" onClick={() => void salvar(null)}>
            Apagar o PIN
          </Botao>
        ) : (
          <span />
        )}
        <div className="flex gap-3">
          <Botao variante="secundario" onClick={aoCancelar}>
            Cancelar
          </Botao>
          <Botao variante="principal" disabled={pin.length < 4} onClick={() => void salvar(pin)}>
            Salvar PIN
          </Botao>
        </div>
      </div>
    </div>
  );
}
