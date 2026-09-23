/**
 * O Electron embrulha o erro do processo main assim:
 *   "Error invoking remote method 'clientes:criar': Error: Telefone inválido."
 * A oficina não pode ver isso. Aqui fica só a última mensagem, que é a que os
 * repositórios escreveram em português dizendo o que fazer.
 */
export function mensagemDeErro(erro: unknown): string {
  if (!erro) return 'Algo deu errado. Tente de novo.';

  const bruto = erro instanceof Error ? erro.message : String(erro);
  const semPrefixoIpc = bruto.replace(/^Error invoking remote method '[^']*':\s*/, '');
  const partes = semPrefixoIpc.split(/Error:\s*/);
  const limpo = (partes[partes.length - 1] ?? semPrefixoIpc).trim();

  return limpo || 'Algo deu errado. Tente de novo.';
}
