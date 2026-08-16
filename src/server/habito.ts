/**
 * O hábito e o resumo da semana, ligados aos dados reais.
 *
 * As contas vivem em `src/lib/habito.ts`, puras e testadas. Aqui só se vai
 * buscar em que dias é que a pessoa registou alguma coisa.
 */

import "server-only";
import { prisma } from "@/server/db";
import { calcularHabito, calcularMedalhas, fraseDoHabito, type Habito, type Medalha } from "@/lib/habito";
import { getSummary } from "@/server/reports";
import { addDays, startOfWeek, todayIso, type IsoDate } from "@/lib/date";
import { formatCents } from "@/lib/money";

/** Meio ano chega para qualquer sequência que interesse mostrar. */
const DIAS_DE_HISTORIA = 200;

/**
 * Em que dias é que se registou alguma coisa.
 *
 * Conta o `createdAt` — o dia em que a pessoa mexeu na app — e não a data do
 * movimento. Se contasse a data do movimento, registar de uma vez o mês
 * inteiro dava uma sequência de 30 dias sem se ter aberto a app 30 vezes, e
 * a sequência deixava de medir hábito nenhum.
 *
 * Movimentos gerados por recorrências ficam de fora pela mesma razão: não
 * houve pessoa nenhuma a registar.
 */
async function diasComRegisto(
  workspaceId: string,
  timezone: string,
  hoje: IsoDate,
): Promise<IsoDate[]> {
  const desde = addDays(hoje, -DIAS_DE_HISTORIA);
  const linhas = await prisma.transaction.findMany({
    where: {
      workspaceId,
      recurringId: null,
      createdAt: { gte: new Date(`${desde}T00:00:00.000Z`) },
    },
    select: { createdAt: true },
  });

  const formatador = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return [...new Set(linhas.map((l) => formatador.format(l.createdAt)))];
}

export type EstadoDoHabito = {
  habito: Habito;
  frase: string;
  medalhas: Medalha[];
  conquistadas: number;
};

export async function estadoDoHabito(
  workspaceId: string,
  timezone: string,
): Promise<EstadoDoHabito> {
  const hoje = todayIso(timezone);
  const [dias, total] = await Promise.all([
    diasComRegisto(workspaceId, timezone, hoje),
    prisma.transaction.count({ where: { workspaceId, deletedAt: null } }),
  ]);

  const habito = calcularHabito(dias, hoje);
  // Semanas distintas em que houve registo — a aproximação honesta a "olhou
  // para as contas", sem inventar uma tabela para contar visitas.
  const semanas = new Set(dias.map((d) => startOfWeek(d))).size;
  const medalhas = calcularMedalhas(habito, total, semanas);

  return {
    habito,
    frase: fraseDoHabito(habito),
    medalhas,
    conquistadas: medalhas.filter((m) => m.conquistada).length,
  };
}

// ─── O resumo da semana ────────────────────────────────────────────────────

export type ResumoSemanal = {
  de: IsoDate;
  ate: IsoDate;
  entrouCents: number;
  saiuCents: number;
  sobrouCents: number;
  /** Diferença face à semana anterior, em percentagem. `null` sem base. */
  variacaoGastos: number | null;
  diasRegistados: number;
  frase: string;
};

export async function resumoSemanal(
  workspaceId: string,
  timezone: string,
): Promise<ResumoSemanal> {
  const hoje = todayIso(timezone);
  const inicio = startOfWeek(hoje);
  const inicioAnterior = addDays(inicio, -7);

  const [esta, anterior, dias] = await Promise.all([
    getSummary(workspaceId, { from: inicio, to: hoje }),
    getSummary(workspaceId, { from: inicioAnterior, to: addDays(inicio, -1) }),
    diasComRegisto(workspaceId, timezone, hoje),
  ]);

  const variacaoGastos =
    anterior.expenseCents > 0
      ? Math.round(
          ((esta.expenseCents - anterior.expenseCents) / anterior.expenseCents) * 100,
        )
      : null;

  const registados = dias.filter((d) => d >= inicio && d <= hoje).length;

  return {
    de: inicio,
    ate: hoje,
    entrouCents: esta.incomeCents,
    saiuCents: esta.expenseCents,
    sobrouCents: esta.netCents,
    variacaoGastos,
    diasRegistados: registados,
    frase: fraseDaSemana(esta.netCents, variacaoGastos, esta.expenseCents),
  };
}

/**
 * Uma frase, não um relatório.
 *
 * Deliberadamente sem exclamações e sem elogios vazios: a app não é uma
 * treinadora entusiasta, é um sítio onde se vê a verdade.
 */
function fraseDaSemana(
  sobrouCents: number,
  variacao: number | null,
  gastouCents: number,
): string {
  if (gastouCents === 0) {
    return "Ainda não há nada registado esta semana.";
  }
  if (variacao === null) {
    return sobrouCents >= 0
      ? `Esta semana sobrou ${formatCents(sobrouCents)}. Ainda não há semana anterior para comparar.`
      : `Esta semana gastou mais do que recebeu, ${formatCents(-sobrouCents)} a mais.`;
  }
  if (variacao <= -10) {
    return `Gastou ${Math.abs(variacao)}% menos do que na semana passada.`;
  }
  if (variacao >= 25) {
    return `Gastou ${variacao}% mais do que na semana passada. Vale a pena ver onde.`;
  }
  return `Uma semana parecida com a anterior: ${
    variacao >= 0 ? `${variacao}% acima` : `${Math.abs(variacao)}% abaixo`
  }.`;
}
