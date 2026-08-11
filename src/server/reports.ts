/**
 * Agregações: é daqui que saem os números do dashboard, dos gráficos e dos
 * relatórios. Um só sítio a calculá-los, para que nenhum ecrã discorde de
 * outro.
 *
 * Todas as funções recebem `workspaceId` como primeiro argumento, e quem as
 * chama obtém-no SEMPRE da sessão.
 *
 * Sinais, recordando: numa Entry de categoria, a despesa é positiva e a
 * receita é negativa. Aqui devolve-se tudo em valores positivos, que é como
 * se lê num ecrã.
 */

import "server-only";
import type { Prisma, Scope } from "@prisma/client";
import { prisma } from "@/server/db";
import { fromIso, toIso, type IsoDate } from "@/lib/date";
import { bucketsFor, type Period } from "@/lib/period";
import { costPerKmCents, negate } from "@/lib/money";

type Range = { from: IsoDate; to: IsoDate };

function dateFilter(range: Range): Prisma.DateTimeFilter {
  return { gte: fromIso(range.from), lte: fromIso(range.to) };
}

function transactionFilter(range: Range, scope?: Scope) {
  return {
    deletedAt: null,
    status: "CLEARED" as const,
    date: dateFilter(range),
    ...(scope ? { scope } : {}),
  };
}

// ─── Totais ────────────────────────────────────────────────────────────────

export type Summary = {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
};

export async function getSummary(
  workspaceId: string,
  range: Range,
  scope?: Scope,
): Promise<Summary> {
  const [income, expense] = await Promise.all([
    prisma.entry.aggregate({
      _sum: { amountCents: true },
      where: {
        workspaceId,
        category: { type: "INCOME" },
        transaction: transactionFilter(range, scope),
      },
    }),
    prisma.entry.aggregate({
      _sum: { amountCents: true },
      where: {
        workspaceId,
        category: { type: "EXPENSE" },
        transaction: transactionFilter(range, scope),
      },
    }),
  ]);

  // Receitas ficam negativas nas linhas de categoria; invertemos o sinal.
  const incomeCents = negate(income._sum.amountCents ?? 0);
  const expenseCents = expense._sum.amountCents ?? 0;

  return { incomeCents, expenseCents, netCents: incomeCents - expenseCents };
}

/** Saldo somado de todas as contas ativas. */
export async function getTotalBalance(workspaceId: string): Promise<number> {
  const agg = await prisma.account.aggregate({
    _sum: { cachedBalanceCents: true },
    where: { workspaceId, archived: false },
  });
  return agg._sum.cachedBalanceCents ?? 0;
}

// ─── Por categoria ─────────────────────────────────────────────────────────

export type CategorySlice = {
  categoryId: string;
  name: string;
  color: string | null;
  cents: number;
};

export async function getByCategory(
  workspaceId: string,
  range: Range,
  type: "INCOME" | "EXPENSE",
  scope?: Scope,
): Promise<CategorySlice[]> {
  const grouped = await prisma.entry.groupBy({
    by: ["categoryId"],
    _sum: { amountCents: true },
    where: {
      workspaceId,
      category: { type },
      transaction: transactionFilter(range, scope),
    },
  });

  const ids = grouped.map((g) => g.categoryId).filter(Boolean) as string[];
  if (ids.length === 0) return [];

  const categories = await prisma.category.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, color: true },
  });
  const byId = new Map(categories.map((c) => [c.id, c]));

  return grouped
    .map((g) => {
      const meta = byId.get(g.categoryId!);
      const raw = g._sum.amountCents ?? 0;
      return {
        categoryId: g.categoryId!,
        name: meta?.name ?? "Sem categoria",
        color: meta?.color ?? null,
        cents: type === "INCOME" ? negate(raw) : raw,
      };
    })
    .filter((s) => s.cents !== 0)
    .sort((a, b) => b.cents - a.cents);
}

// ─── Por fonte de rendimento ───────────────────────────────────────────────

export type SourceSlice = {
  incomeSourceId: string | null;
  name: string;
  color: string | null;
  cents: number;
};

export async function getIncomeBySource(
  workspaceId: string,
  range: Range,
): Promise<SourceSlice[]> {
  const grouped = await prisma.transaction.groupBy({
    by: ["incomeSourceId"],
    where: { workspaceId, type: "INCOME", ...transactionFilter(range) },
    _count: true,
  });
  if (grouped.length === 0) return [];

  // O valor está nas linhas; buscamos os totais por fonte numa segunda passagem.
  const results: SourceSlice[] = [];
  const sources = await prisma.incomeSource.findMany({
    where: { workspaceId },
    select: { id: true, name: true, color: true },
  });
  const byId = new Map(sources.map((s) => [s.id, s]));

  for (const g of grouped) {
    const agg = await prisma.entry.aggregate({
      _sum: { amountCents: true },
      where: {
        workspaceId,
        category: { type: "INCOME" },
        transaction: {
          ...transactionFilter(range),
          type: "INCOME",
          incomeSourceId: g.incomeSourceId,
        },
      },
    });
    const cents = negate(agg._sum.amountCents ?? 0);
    if (cents === 0) continue;
    const meta = g.incomeSourceId ? byId.get(g.incomeSourceId) : null;
    results.push({
      incomeSourceId: g.incomeSourceId,
      name: meta?.name ?? "Sem fonte definida",
      color: meta?.color ?? null,
      cents,
    });
  }

  return results.sort((a, b) => b.cents - a.cents);
}

// ─── Evolução ao longo do tempo ────────────────────────────────────────────

export type EvolutionPoint = {
  key: string;
  label: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  balanceCents: number;
};

/**
 * Uma única consulta traz todas as linhas do período e a agregação é feita
 * em memória. Para os volumes de finanças pessoais (milhares de linhas) é
 * mais rápido do que uma consulta por fatia, e evita 30 idas à base para
 * desenhar um gráfico.
 */
export async function getEvolution(
  workspaceId: string,
  period: Period,
  scope?: Scope,
): Promise<EvolutionPoint[]> {
  const buckets = bucketsFor(period);
  if (buckets.length === 0) return [];

  const entries = await prisma.entry.findMany({
    where: {
      workspaceId,
      categoryId: { not: null },
      transaction: transactionFilter(
        { from: period.from, to: period.to },
        scope,
      ),
    },
    select: {
      amountCents: true,
      category: { select: { type: true } },
      transaction: { select: { date: true } },
    },
  });

  const acc = new Map<string, { income: number; expense: number }>();
  for (const b of buckets) acc.set(b.key, { income: 0, expense: 0 });

  for (const e of entries) {
    const iso = toIso(e.transaction.date);
    const bucket = buckets.find((b) => iso >= b.from && iso <= b.to);
    if (!bucket) continue;
    const slot = acc.get(bucket.key)!;
    if (e.category?.type === "INCOME") slot.income += negate(e.amountCents);
    else slot.expense += e.amountCents;
  }

  // Saldo à data em que o período começa, para a linha de evolução partir do
  // sítio certo em vez de partir do zero.
  const opening = await openingBalanceAt(workspaceId, period.from);

  let running = opening;
  return buckets.map((b) => {
    const slot = acc.get(b.key)!;
    const net = slot.income - slot.expense;
    running += net;
    return {
      key: b.key,
      label: b.label,
      incomeCents: slot.income,
      expenseCents: slot.expense,
      netCents: net,
      balanceCents: running,
    };
  });
}

/** Saldo de todas as contas imediatamente antes de uma data. */
export async function openingBalanceAt(
  workspaceId: string,
  date: IsoDate,
): Promise<number> {
  const [accounts, agg] = await Promise.all([
    prisma.account.aggregate({
      _sum: { openingCents: true },
      where: { workspaceId, archived: false },
    }),
    prisma.entry.aggregate({
      _sum: { amountCents: true },
      where: {
        workspaceId,
        accountId: { not: null },
        account: { archived: false },
        transaction: {
          deletedAt: null,
          status: "CLEARED",
          date: { lt: fromIso(date) },
        },
      },
    }),
  ]);
  return (accounts._sum.openingCents ?? 0) + (agg._sum.amountCents ?? 0);
}

// ─── Veículo: custo real e lucro real ──────────────────────────────────────

export type VehicleStats = {
  vehicleId: string;
  name: string;
  /** Custos lançados como despesa e associados ao veículo. */
  costCents: number;
  costByCategory: CategorySlice[];
  /** Receita de trabalhos feitos com este veículo. */
  revenueCents: number;
  /** Receita − custos. É este o número que interessa. */
  profitCents: number;
  metres: number;
  /** `null` quando não há quilómetros suficientes — não se inventa. */
  costPerKmCents: number | null;
  fuelLiters: number;
  consumptionPer100Km: number | null;
};

export async function getVehicleStats(
  workspaceId: string,
  vehicleId: string,
  range: Range,
): Promise<VehicleStats | null> {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, workspaceId },
    select: { id: true, name: true },
  });
  if (!vehicle) return null;

  const [costAgg, revenueAgg, mileageAgg, fuelRows, costGrouped] =
    await Promise.all([
      prisma.entry.aggregate({
        _sum: { amountCents: true },
        where: {
          workspaceId,
          category: { type: "EXPENSE" },
          transaction: { ...transactionFilter(range), vehicleId },
        },
      }),
      prisma.entry.aggregate({
        _sum: { amountCents: true },
        where: {
          workspaceId,
          category: { type: "INCOME" },
          transaction: { ...transactionFilter(range), vehicleId },
        },
      }),
      prisma.mileageLog.aggregate({
        _sum: { totalMetres: true },
        where: { workspaceId, vehicleId, date: dateFilter(range) },
      }),
      prisma.fuelLog.findMany({
        where: { workspaceId, vehicleId, date: dateFilter(range) },
        select: { litersMl: true },
      }),
      prisma.entry.groupBy({
        by: ["categoryId"],
        _sum: { amountCents: true },
        where: {
          workspaceId,
          category: { type: "EXPENSE" },
          transaction: { ...transactionFilter(range), vehicleId },
        },
      }),
    ]);

  const costCents = costAgg._sum.amountCents ?? 0;
  const revenueCents = negate(revenueAgg._sum.amountCents ?? 0);
  const metres = mileageAgg._sum.totalMetres ?? 0;
  const litersMl = fuelRows.reduce((sum, r) => sum + r.litersMl, 0);

  const categoryIds = costGrouped
    .map((g) => g.categoryId)
    .filter(Boolean) as string[];
  const categories = categoryIds.length
    ? await prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true, color: true },
      })
    : [];
  const byId = new Map(categories.map((c) => [c.id, c]));

  return {
    vehicleId: vehicle.id,
    name: vehicle.name,
    costCents,
    costByCategory: costGrouped
      .map((g) => ({
        categoryId: g.categoryId!,
        name: byId.get(g.categoryId!)?.name ?? "Outros",
        color: byId.get(g.categoryId!)?.color ?? null,
        cents: g._sum.amountCents ?? 0,
      }))
      .filter((s) => s.cents !== 0)
      .sort((a, b) => b.cents - a.cents),
    revenueCents,
    profitCents: revenueCents - costCents,
    metres,
    costPerKmCents: costPerKmCents(costCents, metres),
    fuelLiters: litersMl / 1000,
    consumptionPer100Km:
      metres > 0 && litersMl > 0
        ? Math.round((litersMl / 1000 / (metres / 1000)) * 100 * 10) / 10
        : null,
  };
}

// ─── Orçamento ─────────────────────────────────────────────────────────────

export type BudgetRow = {
  categoryId: string;
  name: string;
  color: string | null;
  plannedCents: number;
  spentCents: number;
  differenceCents: number;
  percent: number;
  over: boolean;
};

export async function getBudgetStatus(
  workspaceId: string,
  month: IsoDate,
): Promise<{
  month: IsoDate;
  rows: BudgetRow[];
  plannedTotal: number;
  spentTotal: number;
}> {
  const monthStart = `${month.slice(0, 7)}-01` as IsoDate;
  const budget = await prisma.budget.findUnique({
    where: { workspaceId_month: { workspaceId, month: fromIso(monthStart) } },
    include: {
      lines: {
        include: {
          category: { select: { id: true, name: true, color: true } },
        },
      },
    },
  });

  const daysInThisMonth = new Date(
    Date.UTC(
      Number(monthStart.slice(0, 4)),
      Number(monthStart.slice(5, 7)),
      0,
    ),
  ).getUTCDate();
  const range = {
    from: monthStart,
    to: `${monthStart.slice(0, 7)}-${String(daysInThisMonth).padStart(2, "0")}`,
  };

  const spentByCategory = await getByCategory(workspaceId, range, "EXPENSE");
  const spentMap = new Map(spentByCategory.map((s) => [s.categoryId, s.cents]));

  const rows: BudgetRow[] = (budget?.lines ?? []).map((line) => {
    const spent = spentMap.get(line.categoryId) ?? 0;
    return {
      categoryId: line.categoryId,
      name: line.category.name,
      color: line.category.color,
      plannedCents: line.plannedCents,
      spentCents: spent,
      differenceCents: line.plannedCents - spent,
      percent:
        line.plannedCents > 0
          ? Math.round((spent / line.plannedCents) * 100)
          : 0,
      over: spent > line.plannedCents && line.plannedCents > 0,
    };
  });

  rows.sort((a, b) => b.percent - a.percent);

  return {
    month: monthStart,
    rows,
    plannedTotal: rows.reduce((s, r) => s + r.plannedCents, 0),
    spentTotal: rows.reduce((s, r) => s + r.spentCents, 0),
  };
}
