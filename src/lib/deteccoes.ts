/**
 * O que a app consegue perceber sozinha, sem inteligência artificial nenhuma.
 *
 * O Rocket Money construiu um negócio inteiro em cima de uma única ideia:
 * dizer às pessoas que subscrições é que elas têm. Nós já temos os dados —
 * faltava olhar para eles.
 *
 * Tudo aqui é puro: entram movimentos, saem conclusões. Sem base de dados,
 * sem rede, sem API paga. É deliberado — estas respostas têm de funcionar
 * mesmo quando o assistente está desligado.
 */

import { diffDays, type IsoDate } from "@/lib/date";
import { divRound, type Cents } from "@/lib/money";

export type MovimentoSimples = {
  id: string;
  date: IsoDate;
  description: string;
  amountCents: Cents;
  categoryName: string | null;
};

/** Compara descrições ignorando acentos, maiúsculas e as referências que mudam. */
function chave(descricao: string): string {
  return descricao
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\d+/g, "")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Subscrições ───────────────────────────────────────────────────────────

export type Subscricao = {
  nome: string;
  categoria: string | null;
  /** O valor mais recente. */
  valorCents: Cents;
  /** Quantas vezes apareceu. */
  ocorrencias: number;
  /** Média de dias entre cobranças. */
  cadenciaDias: number;
  ultimaData: IsoDate;
  /** Quanto custa por ano, se continuar assim. */
  anualCents: Cents;
  /** O valor subiu desde a primeira cobrança? */
  subiuCents: Cents;
};

/**
 * Encontra o que se paga sempre.
 *
 * O sinal de uma subscrição é a REGULARIDADE, não o nome: três ou mais
 * cobranças parecidas, com intervalos parecidos entre elas. É por isso que se
 * exige uma cadência consistente e não apenas repetição — o supermercado
 * também aparece dez vezes por mês e não é uma subscrição.
 */
export function detetarSubscricoes(
  movimentos: readonly MovimentoSimples[],
): Subscricao[] {
  const grupos = new Map<string, MovimentoSimples[]>();
  for (const m of movimentos) {
    if (m.amountCents <= 0) continue;
    const k = chave(m.description);
    if (k.length < 3) continue;
    grupos.set(k, [...(grupos.get(k) ?? []), m]);
  }

  const encontradas: Subscricao[] = [];

  for (const itens of grupos.values()) {
    if (itens.length < 3) continue;
    const ordenados = [...itens].sort((a, b) => a.date.localeCompare(b.date));

    // Valores têm de ser parecidos: uma subscrição não varia 40% de mês para
    // mês. Se varia, é uma compra repetida no mesmo sítio, não uma assinatura.
    const valores = ordenados.map((i) => i.amountCents);
    const menor = Math.min(...valores);
    const maior = Math.max(...valores);
    if (menor === 0 || maior / menor > 1.4) continue;

    const intervalos: number[] = [];
    for (let i = 1; i < ordenados.length; i++) {
      intervalos.push(diffDays(ordenados[i - 1].date, ordenados[i].date));
    }
    const media = divRound(
      intervalos.reduce((s, d) => s + d, 0),
      intervalos.length,
    );
    // Entre semanal e anual. Mais curto do que isso é consumo diário.
    if (media < 6 || media > 400) continue;

    // Regularidade: nenhum intervalo se afasta muito da média.
    const irregular = intervalos.some((d) => Math.abs(d - media) > Math.max(7, media * 0.4));
    if (irregular) continue;

    const ultimo = ordenados[ordenados.length - 1];
    encontradas.push({
      nome: ultimo.description,
      categoria: ultimo.categoryName,
      valorCents: ultimo.amountCents,
      ocorrencias: ordenados.length,
      cadenciaDias: media,
      ultimaData: ultimo.date,
      anualCents: divRound(ultimo.amountCents * 365, media),
      subiuCents: ultimo.amountCents - ordenados[0].amountCents,
    });
  }

  return encontradas.sort((a, b) => b.anualCents - a.anualCents);
}

// ─── Anomalias ─────────────────────────────────────────────────────────────

export type Anomalia = {
  movimento: MovimentoSimples;
  /** Quantas vezes acima do costume. */
  vezes: number;
  habitualCents: Cents;
};

/**
 * "Isto é o dobro do costume."
 *
 * Compara cada despesa com a MEDIANA da sua categoria, não com a média: uma
 * única compra de €900 puxa a média para cima e passa a esconder as compras
 * de €400 que se seguem. A mediana não se deixa levar por um valor extremo,
 * que é exatamente o que estamos a tentar apanhar.
 */
export function detetarAnomalias(
  movimentos: readonly MovimentoSimples[],
  recentesDesde: IsoDate,
): Anomalia[] {
  const porCategoria = new Map<string, Cents[]>();
  for (const m of movimentos) {
    if (m.amountCents <= 0) continue;
    const cat = m.categoryName ?? "—";
    porCategoria.set(cat, [...(porCategoria.get(cat) ?? []), m.amountCents]);
  }

  const anomalias: Anomalia[] = [];

  for (const m of movimentos) {
    if (m.amountCents <= 0 || m.date < recentesDesde) continue;
    const valores = porCategoria.get(m.categoryName ?? "—") ?? [];
    // Menos de 5 exemplos não chega para saber o que é "o costume".
    if (valores.length < 5) continue;

    const mediana = medianaDe(valores);
    if (mediana <= 0) continue;

    const vezes = m.amountCents / mediana;
    // 3× a mediana e pelo menos €20 de diferença: sem o mínimo, um café de
    // €3 quando o costume é €1 aparecia como anomalia todas as semanas.
    if (vezes >= 3 && m.amountCents - mediana >= 2000) {
      anomalias.push({
        movimento: m,
        vezes: Math.round(vezes * 10) / 10,
        habitualCents: mediana,
      });
    }
  }

  return anomalias.sort((a, b) => b.movimento.amountCents - a.movimento.amountCents);
}

function medianaDe(valores: readonly number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0
    ? divRound(ordenados[meio - 1] + ordenados[meio], 2)
    : ordenados[meio];
}

// ─── Fundo de emergência ───────────────────────────────────────────────────

export type FundoDeEmergencia = {
  /** Quantos meses aguenta sem receber nada. `null` se não gasta nada. */
  meses: number | null;
  gastoMensalCents: Cents;
  saldoCents: Cents;
  /** Quanto falta para chegar a 3 e a 6 meses. */
  faltamPara3Cents: Cents;
  faltamPara6Cents: Cents;
  nivel: "sem-rede" | "frágil" | "razoável" | "confortável";
};

/**
 * Quantos meses aguenta se a receita parar amanhã.
 *
 * É o número que mais tranquiliza — ou que mais assusta, e nesse caso é o
 * mais útil de todos. Três meses é o mínimo geralmente aconselhado; seis é o
 * conforto. Não se inventa nada: se não há gastos registados, diz-se que não
 * dá para saber.
 */
export function fundoDeEmergencia(
  saldoCents: Cents,
  gastoMensalCents: Cents,
): FundoDeEmergencia {
  if (gastoMensalCents <= 0) {
    return {
      meses: null,
      gastoMensalCents,
      saldoCents,
      faltamPara3Cents: 0,
      faltamPara6Cents: 0,
      nivel: "sem-rede",
    };
  }

  const meses = Math.round((saldoCents / gastoMensalCents) * 10) / 10;
  return {
    meses,
    gastoMensalCents,
    saldoCents,
    faltamPara3Cents: Math.max(0, gastoMensalCents * 3 - saldoCents),
    faltamPara6Cents: Math.max(0, gastoMensalCents * 6 - saldoCents),
    nivel:
      meses >= 6 ? "confortável" : meses >= 3 ? "razoável" : meses >= 1 ? "frágil" : "sem-rede",
  };
}

// ─── Regra 50/30/20 ────────────────────────────────────────────────────────

/**
 * Categorias que quase toda a gente considera necessidades. Serve de ponto de
 * partida, não de verdade: a app mostra a divisão e deixa discordar.
 */
const NECESSIDADES = [
  "renda",
  "agua",
  "eletricidade",
  "gas",
  "internet",
  "telefone",
  "alimentacao",
  "supermercado",
  "transportes",
  "saude",
  "seguro",
  "combustivel",
  "educacao",
  "impostos",
  "manutencao",
];

export type Reparticao = {
  necessidadesCents: Cents;
  desejosCents: Cents;
  sobrouCents: Cents;
  necessidadesPercent: number;
  desejosPercent: number;
  sobrouPercent: number;
  /** A regra diz 50/30/20. Isto é o que está a acontecer. */
  comentario: string;
};

export function repartir(
  rendimentoCents: Cents,
  despesasPorCategoria: readonly { nome: string; cents: Cents }[],
): Reparticao | null {
  if (rendimentoCents <= 0) return null;

  let necessidades = 0;
  let desejos = 0;
  for (const d of despesasPorCategoria) {
    const k = chave(d.nome);
    if (NECESSIDADES.some((n) => k.includes(n))) necessidades += d.cents;
    else desejos += d.cents;
  }

  const sobrou = rendimentoCents - necessidades - desejos;
  const p = (v: number) => Math.round((v / rendimentoCents) * 100);
  const np = p(necessidades);
  const dp = p(desejos);
  const sp = p(sobrou);

  let comentario: string;
  if (sobrou < 0) {
    comentario =
      "Está a gastar mais do que recebe. A regra 50/30/20 não se aplica " +
      "enquanto isso acontecer — primeiro há que fechar o buraco.";
  } else if (np > 60) {
    comentario =
      `As necessidades levam ${np}% do que recebe, quando a regra sugere 50%. ` +
      "Com tanta coisa fixa, sobra pouco espaço para decidir — e isso não se " +
      "resolve cortando cafés, resolve-se mexendo numa das grandes.";
  } else if (sp >= 20) {
    comentario = `Está a guardar ${sp}% do que recebe. A regra sugere 20%; está acima.`;
  } else {
    comentario =
      `Sobra-lhe ${sp}% do que recebe. A regra 50/30/20 sugere 20% — a ` +
      `diferença está nos ${dp}% de gastos que não são essenciais.`;
  }

  return {
    necessidadesCents: necessidades,
    desejosCents: desejos,
    sobrouCents: sobrou,
    necessidadesPercent: np,
    desejosPercent: dp,
    sobrouPercent: sp,
    comentario,
  };
}
