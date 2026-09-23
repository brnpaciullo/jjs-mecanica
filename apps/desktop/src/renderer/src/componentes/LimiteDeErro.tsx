import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface Estado {
  erro: Error | null;
}

/**
 * Última rede de segurança da interface.
 *
 * Sem isto, qualquer erro de renderização derruba a árvore do React e sobra uma
 * **janela totalmente branca** — que não diz nada para quem está na oficina e
 * nada para quem vai consertar. Aqui o erro vira uma tela legível, com o texto
 * técnico guardado num bloco que dá para copiar e me mandar.
 */
export class LimiteDeErro extends Component<Props, Estado> {
  override state: Estado = { erro: null };

  static getDerivedStateFromError(erro: Error): Estado {
    return { erro };
  }

  override componentDidCatch(erro: Error, info: ErrorInfo): void {
    console.error('Erro na tela:', erro, info.componentStack);
  }

  override render(): ReactNode {
    const { erro } = this.state;
    if (!erro) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-jjs-papel p-8">
        <div className="max-w-2xl rounded-card border border-jjs-vermelho bg-jjs-branco p-6">
          <h1 className="font-titulo text-3xl text-jjs-preto">Essa tela travou</h1>
          <p className="mt-3 text-lg">
            O sistema continua funcionando e nenhum dado foi perdido. Feche e abra o sistema de
            novo.
          </p>
          <p className="mt-2 text-jjs-texto-fraco">
            Se continuar acontecendo, copie o texto abaixo e mande para quem cuida do sistema.
          </p>

          <pre className="mt-4 max-h-64 overflow-auto rounded-campo bg-jjs-papel p-3 text-sm">
            {erro.message}
            {erro.stack ? `\n\n${erro.stack}` : ''}
          </pre>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 min-h-toque rounded-campo bg-jjs-amarelo px-5 font-semibold text-jjs-preto hover:bg-jjs-amarelo-escuro"
          >
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }
}
