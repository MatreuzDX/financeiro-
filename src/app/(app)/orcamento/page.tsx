import type { Metadata } from "next";
import { requireSession } from "@/server/auth/guard";
import { listCategories } from "@/server/categories";
import { getBudgetLines } from "@/server/budget";
import { getBudgetStatus, getSummary } from "@/server/reports";
import {
  endOfMonth,
  formatMonthYear,
  startOfMonth,
  todayIso,
  type IsoDate,
} from "@/lib/date";
import { formatCents } from "@/lib/money";
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  ProgressBar,
} from "@/components/ui";
import { BudgetForm } from "./budget-form";

export const metadata: Metadata = { title: "Orçamento" };

export default async function OrcamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const session = await requireSession("/orcamento");
  const params = await searchParams;
  const today = todayIso(session.timezone);

  const month = startOfMonth(
    (params.mes && /^\d{4}-\d{2}$/.test(params.mes)
      ? `${params.mes}-01`
      : today) as IsoDate,
  );

  const [categories, planned, status, summary] = await Promise.all([
    listCategories(session.workspaceId, "EXPENSE"),
    getBudgetLines(session.workspaceId, month),
    getBudgetStatus(session.workspaceId, month),
    getSummary(session.workspaceId, { from: month, to: endOfMonth(month) }),
  ]);

  const remaining = status.plannedTotal - status.spentTotal;
  const percent =
    status.plannedTotal > 0
      ? Math.round((status.spentTotal / status.plannedTotal) * 100)
      : 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Orçamento"
        description={`Quanto planeou gastar em ${formatMonthYear(month).toLowerCase()}, e quanto já gastou.`}
      />

      {status.plannedTotal > 0 ? (
        <Card className="animate-rise">
          <CardHeader
            title="Este mês"
            hint={`${formatCents(status.spentTotal)} gastos de ${formatCents(status.plannedTotal)} orçamentados`}
          />
          <ProgressBar
            percent={percent}
            tone={percent > 100 ? "negative" : percent > 80 ? "warning" : "primary"}
          />
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[11px] text-muted">Orçamentado</p>
              <p className="tabular text-sm font-semibold text-ink">
                {formatCents(status.plannedTotal)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted">Gasto</p>
              <p className="tabular text-sm font-semibold text-ink">
                {formatCents(status.spentTotal)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted">
                {remaining >= 0 ? "Resta" : "Excedeu"}
              </p>
              <p
                className={`tabular text-sm font-semibold ${
                  remaining >= 0 ? "text-positive" : "text-negative"
                }`}
              >
                {formatCents(Math.abs(remaining))}
              </p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted">
            Receitas do mês: {formatCents(summary.incomeCents)} · Despesas
            totais (dentro e fora do orçamento):{" "}
            {formatCents(summary.expenseCents)}
          </p>
        </Card>
      ) : null}

      {status.rows.length > 0 ? (
        <Card>
          <CardHeader title="Por categoria" />
          <ul className="space-y-3">
            {status.rows.map((row) => (
              <li key={row.categoryId}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-ink">
                    {row.name}
                  </span>
                  <span className="tabular shrink-0 text-muted">
                    {formatCents(row.spentCents)} / {formatCents(row.plannedCents)}
                    <span
                      className={`ml-2 ${row.over ? "text-negative" : "text-faint"}`}
                    >
                      {row.percent}%
                    </span>
                  </span>
                </div>
                <ProgressBar
                  percent={row.percent}
                  tone={
                    row.over ? "negative" : row.percent > 80 ? "warning" : "primary"
                  }
                />
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card>
          <EmptyState
            title="Ainda sem orçamento este mês"
            description="Escreva quanto quer gastar em cada categoria. Só as que preencher entram no orçamento."
          />
        </Card>
      )}

      <BudgetForm
        month={month}
        monthLabel={formatMonthYear(month)}
        lines={categories.map((c) => ({
          categoryId: c.id,
          name: c.name,
          color: c.color,
          plannedCents: planned.get(c.id) ?? 0,
        }))}
      />
    </div>
  );
}
