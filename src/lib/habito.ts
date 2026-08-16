/**
 * O que traz a pessoa de volta amanhã.
 *
 * O estudo é duro com as apps de finanças: 26% sobrevivem ao primeiro dia e
 * 4,5% ao trigésimo. Não é por serem más — é porque não há nada que puxe.
 *
 * Streaks aparecem em estudos comportamentais com +41% em depósitos de
 * poupança a seis meses, mais eficazes do que incentivos em dinheiro do mesmo
 * valor. E há um aviso na mesma investigação que se leva a sério aqui:
 * **premiar o hábito, não o saldo**. Contar euros poupados empurra as pessoas
 * para transferências que não podem fazer. Contar dias em que registaram, não.
 *
 * Módulo puro: entra uma lista de dias, sai o estado do hábito.
 */

import { addDays, type IsoDate } from "@/lib/date";

export type Habito = {
  /** Dias seguidos, a contar de hoje ou de ontem. */
  atual: number;
  /** O melhor de sempre. */
  recorde: number;
  /** Já registou alguma coisa hoje? */
  hojeFeito: boolean;
  /**
   * O perdão foi gasto para manter esta sequência viva. Mostra-se, para a
   * pessoa saber que já não tem rede.
   */
  perdaoUsado: boolean;
  /** Últimos 7 dias, do mais antigo para o mais recente. */
  ultimosSete: { dia: IsoDate; feito: boolean }[];
};

/**
 * Um dia de folga é perdoado; dois partem a sequência.
 *
 * Uma sequência que parte à primeira falha desmotiva mais do que motiva —
 * falha-se um domingo e desiste-se na segunda. Com uma rede, a pessoa
 * recupera. Com duas, deixa de haver sequência nenhuma.
 */
const PERDAO = 1;

export function calcularHabito(
  diasComRegisto: readonly IsoDate[],
  hoje: IsoDate,
): Habito {
  const dias = new Set(diasComRegisto);
  const hojeFeito = dias.has(hoje);

  // A sequência conta a partir de hoje; se ainda não registou hoje, a partir
  // de ontem — senão a sequência "morria" todas as manhãs até se abrir a app.
  let cursor = hojeFeito ? hoje : addDays(hoje, -1);
  let atual = 0;
  let perdoesRestantes = PERDAO;

  // 400 dias é mais do que qualquer sequência plausível e evita um ciclo
  // infinito se algum dia entrar aqui uma data maluca.
  for (let i = 0; i < 400; i++) {
    if (dias.has(cursor)) {
      atual++;
      cursor = addDays(cursor, -1);
      continue;
    }
    if (perdoesRestantes > 0 && atual > 0) {
      // Um buraco só: perdoa-se e continua-se a contar para trás.
      perdoesRestantes--;
      cursor = addDays(cursor, -1);
      continue;
    }
    break;
  }
  const perdaoUsado = perdoesRestantes < PERDAO;

  return {
    atual,
    recorde: melhorSequencia(dias),
    hojeFeito,
    perdaoUsado: perdaoUsado && atual > 0,
    ultimosSete: Array.from({ length: 7 }, (_, i) => {
      const dia = addDays(hoje, -(6 - i));
      return { dia, feito: dias.has(dia) };
    }),
  };
}

/** O melhor de sempre, sem perdões: aqui é a medida honesta. */
function melhorSequencia(dias: ReadonlySet<IsoDate>): number {
  const ordenados = [...dias].sort();
  let melhor = 0;
  let corrida = 0;
  let anterior: IsoDate | null = null;

  for (const dia of ordenados) {
    corrida = anterior !== null && addDays(anterior, 1) === dia ? corrida + 1 : 1;
    if (corrida > melhor) melhor = corrida;
    anterior = dia;
  }
  return melhor;
}

// ─── Medalhas ──────────────────────────────────────────────────────────────

export type Medalha = {
  id: string;
  titulo: string;
  descricao: string;
  conquistada: boolean;
  /** 0 a 100. Para mostrar o quanto falta. */
  progresso: number;
};

/**
 * Medalhas pelo HÁBITO, nunca pelo saldo.
 *
 * "Poupou €1 000" premeia quem já tinha dinheiro e humilha quem não tem.
 * "Registou 30 dias seguidos" está ao alcance de toda a gente e é o que
 * realmente muda alguma coisa.
 */
export function calcularMedalhas(
  habito: Habito,
  totalMovimentos: number,
  semanasComResumo: number,
): Medalha[] {
  const marcos: { dias: number; titulo: string; descricao: string }[] = [
    { dias: 3, titulo: "Arrancou", descricao: "Três dias seguidos a registar" },
    { dias: 7, titulo: "Uma semana", descricao: "Sete dias sem falhar" },
    { dias: 30, titulo: "Um mês", descricao: "Trinta dias seguidos" },
    { dias: 100, titulo: "Cem dias", descricao: "Isto já é um hábito, não é esforço" },
  ];

  const medalhas: Medalha[] = marcos.map((m) => ({
    id: `seq-${m.dias}`,
    titulo: m.titulo,
    descricao: m.descricao,
    conquistada: habito.recorde >= m.dias,
    progresso: Math.min(100, Math.round((habito.recorde / m.dias) * 100)),
  }));

  medalhas.push({
    id: "primeiro",
    titulo: "O primeiro",
    descricao: "Registou o primeiro movimento",
    conquistada: totalMovimentos >= 1,
    progresso: totalMovimentos >= 1 ? 100 : 0,
  });

  medalhas.push({
    id: "cem-movimentos",
    titulo: "Cem movimentos",
    descricao: "A app já sabe o suficiente para lhe dizer coisas úteis",
    conquistada: totalMovimentos >= 100,
    progresso: Math.min(100, Math.round((totalMovimentos / 100) * 100)),
  });

  medalhas.push({
    id: "quatro-semanas",
    titulo: "Quatro revisões",
    descricao: "Olhou para as contas quatro semanas diferentes",
    conquistada: semanasComResumo >= 4,
    progresso: Math.min(100, Math.round((semanasComResumo / 4) * 100)),
  });

  return medalhas;
}

/** Uma frase sobre a sequência. Nunca de castigo — isso afasta. */
export function fraseDoHabito(h: Habito): string {
  if (h.atual === 0) {
    return "Registe um movimento hoje e a sequência começa.";
  }
  if (h.atual === 1) {
    return h.hojeFeito ? "Primeiro dia. Amanhã são dois." : "Ontem registou. Hoje ainda vai a tempo.";
  }
  if (!h.hojeFeito) {
    return `${h.atual} dias seguidos. Ainda não registou nada hoje — vai a tempo.`;
  }
  if (h.perdaoUsado) {
    return `${h.atual} dias. Falhou um pelo caminho e a sequência aguentou — mas a rede já foi usada.`;
  }
  if (h.atual >= 30) return `${h.atual} dias seguidos. Isto já não é esforço, é hábito.`;
  if (h.atual >= 7) return `${h.atual} dias seguidos. Uma semana inteira.`;
  return `${h.atual} dias seguidos.`;
}
