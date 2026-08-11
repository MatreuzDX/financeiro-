import type { Metadata } from "next";
import { requireSession } from "@/server/auth/guard";
import {
  INCOME_SOURCE_TYPE_LABELS,
  listIncomeSources,
} from "@/server/income-sources";
import { getIncomeBySource } from "@/server/reports";
import { resolvePeriod } from "@/lib/period";
import { todayIso } from "@/lib/date";
import { formatCents } from "@/lib/money";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { PeriodPicker } from "@/components/period-picker";
import { SourceForm } from "./source-form";

export const metadata: Metadata = { title: "Fontes de renda" };

export default async function FontesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireSession("/fontes");
  const params = await searchParams;
  const today = todayIso(session.timezone);
  const period = resolvePeriod({
    periodo: params.periodo,
    de: params.de,
    ate: params.ate,
    today,
  });

  const [sources, bySource] = await Promise.all([
    listIncomeSources(session.workspaceId),
    getIncomeBySource(session.workspaceId, { from: period.from, to: period.to }),
  ]);

  const earned = new Map(bySource.map((s) => [s.incomeSourceId, s.cents]));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fontes de renda"
        description="Cada trabalho, negócio ou rendimento com o seu próprio histórico."
      />

      <PeriodPicker current={period.key} from={period.from} to={period.to} />

      <SourceForm />

      {sources.length === 0 ? (
        <Card>
          <EmptyState
            title="Ainda não há fontes de rendimento"
            description="Separe o ordenado das entregas e dos trabalhos avulsos para saber quanto rende cada coisa."
          />
        </Card>
      ) : (
        <ul className="space-y-2">
          {sources.map((source) => (
            <li key={source.id}>
              <Card className="flex items-center gap-3 p-3.5">
                <span
                  className="h-8 w-1 shrink-0 rounded-full"
                  style={{ background: source.color ?? "var(--primary)" }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {source.name}
                  </p>
                  <p className="truncate text-[11px] text-muted">
                    {INCOME_SOURCE_TYPE_LABELS[source.type]}
                    {source.scope === "BUSINESS" ? " · Profissional" : " · Pessoal"}
                  </p>
                </div>
                {!source.active ? <Badge>Inativa</Badge> : null}
                <div className="shrink-0 text-right">
                  <p className="tabular text-sm font-semibold text-ink">
                    {formatCents(earned.get(source.id) ?? 0)}
                  </p>
                  <p className="text-[10px] text-faint">no período</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
