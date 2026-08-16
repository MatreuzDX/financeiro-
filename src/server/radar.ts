/**
 * O radar: o que a app percebe sozinha, sem inteligência artificial nenhuma.
 *
 * As conclusões vivem em `src/lib/deteccoes.ts`, puras e com 20 testes. Aqui
 * só se vai buscar os movimentos e se juntam as peças.
 */

import "server-only";
import { prisma } from "@/server/db";
import {
  detetarAnomalias,
  detetarSubscricoes,
  fundoDeEmergencia,
  repartir,
  type Anomalia,
  type FundoDeEmergencia,
  type MovimentoSimples,
  type Reparticao,
  type Subscricao,
} from "@/lib/deteccoes";
import { getByCategory, getSummary, getTotalBalance } from "@/server/reports";
import { addMonths, addDays, startOfMonth, todayIso, toIso } from "@/lib/date";
import { divRound } from "@/lib/money";

/** Um ano chega para ver padrões e não sobrecarrega a consulta. */
const MESES_DE_HISTORIA = 12;

export type Radar = {
  subscricoes: Subscricao[];
  subscricoesAnualCents: number;
  anomalias: Anomalia[];
  fundo: FundoDeEmergencia;
  reparticao: Reparticao | null;
  /** Meses realmente usados na média dos gastos. */
  mesesAnalisados: number;
};

export async function construirRadar(
  workspaceId: string,
  timezone: string,
): Promise<Radar> {
  const hoje = todayIso(timezone);
  const desde = startOfMonth(addMonths(hoje, -(MESES_DE_HISTORIA - 1)));
  const mesPassado = startOfMonth(addMonths(hoje, -1));

  const linhas = await prisma.entry.findMany({
    where: {
      workspaceId,
      categoryId: { not: null },
      transaction: {
        deletedAt: null,
        status: "CLEARED",
        date: { gte: new Date(`${desde}T00:00:00.000Z`) },
      },
    },
    select: {
      id: true,
      amountCents: true,
      category: { select: { name: true } },
      transaction: { select: { date: true, description: true } },
    },
  });

  const movimentos: MovimentoSimples[] = linhas.map((l) => ({
    id: l.id,
    date: toIso(l.transaction.date),
    description: l.transaction.description,
    // Nas linhas de categoria a despesa é positiva e a receita negativa —
    // é a convenção do livro de lançamentos e as deteções contam com ela.
    amountCents: l.amountCents,
    categoryName: l.category?.name ?? null,
  }));

  const [saldoCents, doMes, categorias] = await Promise.all([
    getTotalBalance(workspaceId),
    getSummary(workspaceId, { from: startOfMonth(hoje), to: hoje }),
    getByCategory(
      workspaceId,
      { from: startOfMonth(hoje), to: hoje },
      "EXPENSE",
    ),
  ]);

  // Média de gastos: só meses COMPLETOS. Incluir o mês a meio dava sempre um
  // gasto médio artificialmente baixo no dia 3 e um fundo de emergência
  // falsamente confortável.
  const despesasPorMes = new Map<string, number>();
  for (const m of movimentos) {
    if (m.amountCents <= 0) continue;
    if (m.date >= startOfMonth(hoje)) continue;
    const mes = m.date.slice(0, 7);
    despesasPorMes.set(mes, (despesasPorMes.get(mes) ?? 0) + m.amountCents);
  }
  const meses = [...despesasPorMes.values()];
  const gastoMensalCents =
    meses.length > 0 ? divRound(meses.reduce((s, v) => s + v, 0), meses.length) : 0;

  const subscricoes = detetarSubscricoes(movimentos).filter(
    // Uma subscrição que não é cobrada há três cadências foi cancelada.
    (s) => s.ultimaData >= addDays(hoje, -Math.round(s.cadenciaDias * 3)),
  );

  return {
    subscricoes,
    subscricoesAnualCents: subscricoes.reduce((s, x) => s + x.anualCents, 0),
    anomalias: detetarAnomalias(movimentos, mesPassado).slice(0, 8),
    fundo: fundoDeEmergencia(saldoCents, gastoMensalCents),
    reparticao: repartir(
      doMes.incomeCents,
      categorias.map((c) => ({ nome: c.name, cents: c.cents })),
    ),
    mesesAnalisados: meses.length,
  };
}
