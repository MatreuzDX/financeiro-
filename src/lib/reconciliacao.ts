/**
 * "O banco diz X, a app diz Y."
 *
 * É a funcionalidade que o Firefly III tem e que faltava aqui — e é a única
 * que protege contra o problema mais silencioso de todos: a app afastar-se da
 * realidade sem ninguém dar conta.
 *
 * COMO É QUE ISTO ACONTECE, mesmo com tudo bem feito: esqueceu-se um
 * levantamento em dinheiro; um movimento foi importado duas vezes de dois
 * ficheiros com formatos diferentes e a impressão digital não coincidiu; uma
 * comissão de €1,20 que o banco cobrou e ninguém registou. Nenhum destes é um
 * erro do programa, e todos afastam a app do extrato.
 *
 * A diferença cresce devagar e um dia os números deixam de servir para
 * decidir nada. Reconciliar é olhar para o saldo do banco uma vez por mês e
 * dizer "está certo" — ou registar o que falta.
 *
 * Módulo puro: entra o saldo do banco e o da app, sai o que fazer.
 */

import type { Cents } from "@/lib/money";

export type Diferenca = {
  bancoCents: Cents;
  appCents: Cents;
  /** Positivo: o banco tem mais do que a app diz. */
  diferencaCents: Cents;
  bate: boolean;
  /** Em que direção falta um movimento, e de que tipo. */
  sugestao: string;
  gravidade: "certo" | "pequena" | "grande";
};

/**
 * Abaixo de um cêntimo é igual. Não há tolerância nenhuma: com dinheiro em
 * cêntimos inteiros, "quase certo" não existe — ou bate ou não bate.
 */
export function compararSaldo(bancoCents: Cents, appCents: Cents): Diferenca {
  const diferencaCents = bancoCents - appCents;
  const bate = diferencaCents === 0;
  const abs = Math.abs(diferencaCents);

  let sugestao: string;
  if (bate) {
    sugestao = "Bate certo. Não há nada a fazer.";
  } else if (diferencaCents > 0) {
    sugestao =
      "O banco tem mais do que a app. Falta registar dinheiro que entrou — " +
      "uma transferência recebida, um reembolso, ou uma receita esquecida.";
  } else {
    sugestao =
      "A app diz mais do que o banco. Falta registar dinheiro que saiu — " +
      "um levantamento, uma comissão do banco, ou um pagamento esquecido.";
  }

  return {
    bancoCents,
    appCents,
    diferencaCents,
    bate,
    sugestao,
    gravidade: bate ? "certo" : abs < 2000 ? "pequena" : "grande",
  };
}

/**
 * Sugere movimentos que possam explicar a diferença.
 *
 * Procura entre os movimentos recentes um cujo valor bata EXATAMENTE com a
 * diferença. É a causa mais vulgar de longe: um movimento apagado por engano,
 * ou um lançado com o sinal trocado.
 *
 * Não adivinha combinações de dois ou três movimentos — com dez candidatos há
 * mil combinações e quase todas são coincidência. Um palpite errado numa app
 * de dinheiro custa mais do que não dar palpite nenhum.
 */
export function candidatos<T extends { amountCents: Cents }>(
  diferencaCents: Cents,
  movimentos: readonly T[],
): T[] {
  const alvo = Math.abs(diferencaCents);
  if (alvo === 0) return [];
  return movimentos.filter((m) => Math.abs(m.amountCents) === alvo).slice(0, 5);
}
