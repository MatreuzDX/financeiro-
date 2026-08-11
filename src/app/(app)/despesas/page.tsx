import type { Metadata } from "next";
import { requireSession } from "@/server/auth/guard";
import { listTransactions } from "@/server/ledger";
import { getByCategory, getSummary } from "@/server/reports";
import { resolvePeriod } from "@/lib/period";
import { todayIso } from "@/lib/date";
import { formatCents } from "@/lib/money";
import { Card, CardHeader, LinkButton, PageHeader } from "@/components/ui";
import { PeriodPicker } from "@/components/period-picker";
import { TransactionList } from "@/components/transaction-list";
import { CategoryDonut } from "@/components/charts";

export const metadata: Metadata = { title: "Despesas" };

export default async function DespesasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireSession("/despesas");
  const params = await searchParams;
  const today = todayIso(session.timezone);
  const period = resolvePeriod({
    periodo: params.periodo,
    de: params.de,
    ate: params.ate,
    today,
  });
  const range = { from: period.from, to: period.to };

  const [{ rows }, summary, byCategory] = await Promise.all([
    listTransactions(session.workspaceId, { ...range, type: "EXPENSE" }, { take: 100 }),
    getSummary(session.workspaceId, range),
    getByCategory(session.workspaceId, range, "EXPENSE"),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Despesas"
        description={`${formatCents(summary.expenseCents)} em ${period.label.toLowerCase()}`}
        action={
          <LinkButton href="/movimentos/novo" size="sm">
            Nova
          </LinkButton>
        }
      />

      <PeriodPicker current={period.key} from={period.from} to={period.to} />

      <Card>
        <CardHeader title="Onde foi o dinheiro" hint="Por categoria" />
        <CategoryDonut
          data={byCategory.map((c) => ({
            name: c.name,
            cents: c.cents,
            color: c.color,
          }))}
        />
      </Card>

      <TransactionList
        rows={rows}
        today={today}
        emptyTitle="Sem despesas neste período"
        emptyDescription="Nada registado — ou ainda não começou a registar."
      />
    </div>
  );
}
