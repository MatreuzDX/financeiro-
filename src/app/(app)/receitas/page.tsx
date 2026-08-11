import type { Metadata } from "next";
import { requireSession } from "@/server/auth/guard";
import { listTransactions } from "@/server/ledger";
import { getByCategory, getIncomeBySource, getSummary } from "@/server/reports";
import { resolvePeriod } from "@/lib/period";
import { todayIso } from "@/lib/date";
import { formatCents } from "@/lib/money";
import { Card, CardHeader, LinkButton, PageHeader } from "@/components/ui";
import { PeriodPicker } from "@/components/period-picker";
import { TransactionList } from "@/components/transaction-list";
import { CategoryDonut, SourceBars } from "@/components/charts";

export const metadata: Metadata = { title: "Receitas" };

export default async function ReceitasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireSession("/receitas");
  const params = await searchParams;
  const today = todayIso(session.timezone);
  const period = resolvePeriod({
    periodo: params.periodo,
    de: params.de,
    ate: params.ate,
    today,
  });
  const range = { from: period.from, to: period.to };

  const [{ rows }, summary, byCategory, bySource] = await Promise.all([
    listTransactions(session.workspaceId, { ...range, type: "INCOME" }, { take: 100 }),
    getSummary(session.workspaceId, range),
    getByCategory(session.workspaceId, range, "INCOME"),
    getIncomeBySource(session.workspaceId, range),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Receitas"
        description={`${formatCents(summary.incomeCents)} em ${period.label.toLowerCase()}`}
        action={
          <LinkButton href="/movimentos/novo?tipo=receita" size="sm">
            Nova
          </LinkButton>
        }
      />

      <PeriodPicker current={period.key} from={period.from} to={period.to} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Por fonte de rendimento" />
          <SourceBars
            data={bySource.map((s) => ({
              name: s.name,
              cents: s.cents,
              color: s.color,
            }))}
          />
        </Card>
        <Card>
          <CardHeader title="Por categoria" />
          <CategoryDonut
            data={byCategory.map((c) => ({
              name: c.name,
              cents: c.cents,
              color: c.color,
            }))}
          />
        </Card>
      </div>

      <TransactionList
        rows={rows}
        today={today}
        emptyTitle="Sem receitas neste período"
        emptyDescription="Registe uma receita ou um trabalho para começar a ver de onde vem o dinheiro."
      />
    </div>
  );
}
