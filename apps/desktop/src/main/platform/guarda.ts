/**
 * Tudo que e especifico de Windows mora nesta pasta, atras desta guarda.
 * O alvo de producao e so Windows, mas o desenvolvimento acontece no Linux:
 * cada funcao daqui precisa ter comportamento neutro fora do Windows
 * (registra no log e segue), nunca estourar.
 */
export const EH_WINDOWS = process.platform === 'win32';
