import type { Metadata } from "next";
import { Download } from "lucide-react";
import { requireSession } from "@/server/auth/guard";
import {
  getByCategory,
  getEvolution,
  getIncomeBySource,
  getSummary,
  getTotalBalance,
} from "@/server/reports";
import { listVehicles } from "@/server/vehicles";
import { getVehicleStats } from "@/server/reports";
import { resolvePeriod, periodToQuery } from "@/lib/period";
import { todayIso } from "@/lib/date";
import { formatCents, formatCostPerKm, metresToKmString } from "@/lib/money";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { PeriodPicker } from "@/components/period-picker";
import {
  BalanceChart,
  CategoryDonut,
  IncomeExpenseChart,
  SourceBars,
} from "@/components/charts";

export const metadata: Metadata = { title: "Relatórios" };

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireSession("/relatorios");
  const params = await searchParams;
  const today = todayIso(session.timezone);
  const period = resolvePeriod({
    periodo: params.periodo,
    de: params.de,
    ate: params.ate,
    today,
  });
  const range = { from: period.from, to: period.to };

  const [
    summary,
    personal,
    business,
    balance,
    evolution,
    expenses,
    incomes,
    sources,
    vehicles,
  ] = await Promise.all([
    getSummary(session.workspaceId, range),
    getSummary(session.workspaceId, range, "PERSONAL"),
    getSummary(session.workspaceId, range, "BUSINESS"),
    getTotalBalance(session.workspaceId),
    getEvolution(session.workspaceId, period),
    getByCategory(session.workspaceId, range, "EXPENSE"),
    getByCategory(session.workspaceId, range, "INCOME"),
    getIncomeBySource(session.workspaceId, range),
    listVehicles(session.workspaceId, true),
  ]);

  const vehicleStats = await Promise.all(
    vehicles.map((v) => getVehicleStats(session.workspaceId, v.id, range)),
  );

  const series = evolution.map((p) => ({
    label: p.label,
    incomeCents: p.incomeCents,
    expenseCents: p.expenseCents,
    balanceCents: p.balanceCents,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Relatórios"
        description={period.label}
        action={
          <a
            href={`/api/export/movimentos?${periodToQuery(period)}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3 text-xs font-medium text-ink hover:bg-surface-hover"
          >
            <Download size={14} aria-hidden />
            CSV
          </a>
        }
      />

      <PeriodPicker current={period.key} from={period.from} to={period.to} />

      <Card className="animate-rise">
        <CardHeader title="Resumo" hint={period.label} />
        <dl className="space-y-2">
          <Row label="Receitas" value={formatCents(summary.incomeCents)} />
          <Row label="Despesas" value={`− ${formatCents(summary.expenseCents)}`} />
          <div className="border-t border-line pt-2">
            <Row
              label="Resultado"
              value={formatCents(summary.netCents)}
              strong
              tone={summary.netCents >= 0 ? "positive" : "negative"}
            />
          </div>
          <div className="border-t border-line pt-2">
            <Row label="Saldo atual das contas" value={formatCents(balance)} />
          </div>
        </dl>
      </Card>

      {/* ── Pessoal vs profissional ────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader title="Pessoal" />
          <dl className="space-y-1.5">
            <Row label="Receitas" value={formatCents(personal.incomeCents)} />
            <Row label="Despesas" value={formatCents(personal.expenseCents)} />
            <Row
              label="Resultado"
              value={formatCents(personal.netCents)}
              strong
              tone={personal.netCents >= 0 ? "positive" : "negative"}
            />
          </dl>
        </Card>
        <Card>
          <CardHeader title="Profissional" />
          <dl className="space-y-1.5">
            <Row label="Receitas" value={formatCents(business.incomeCents)} />
            <Row label="Custos" value={formatCents(business.expenseCents)} />
            <Row
              label="Lucro"
              value={formatCents(business.netCents)}
              strong
              tone={business.netCents >= 0 ? "positive" : "negative"}
            />
          </dl>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Receitas e despesas" />
          <IncomeExpenseChart data={series} />
        </Card>
        <Card>
          <CardHeader title="Evolução do saldo" />
          <BalanceChart data={series} />
        </Card>
        <Card>
          <CardHeader title="Despesas por categoria" />
          <CategoryDonut
            data={expenses.map((c) => ({
              name: c.name,
              cents: c.cents,
              color: c.color,
            }))}
          />
        </Card>
        <Card>
          <CardHeader title="Receitas por categoria" />
          <CategoryDonut
            data={incomes.map((c) => ({
              name: c.name,
              cents: c.cents,
              color: c.color,
            }))}
          />
        </Card>
      </div>

      <Card>
        <CardHeader title="Receitas por fonte" />
        <SourceBars
          data={sources.map((s) => ({
            name: s.name,
            cents: s.cents,
            color: s.color,
          }))}
        />
      </Card>

      {vehicleStats.filter(Boolean).length > 0 ? (
        <Card>
          <CardHeader title="Veículos" hint="Receita, custo e lucro por veículo" />
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[34rem] text-left text-xs">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-2 font-medium">Veículo</th>
                  <th className="py-2 text-right font-medium">Km</th>
                  <th className="py-2 text-right font-medium">Recebido</th>
                  <th className="py-2 text-right font-medium">Custos</th>
                  <th className="py-2 text-right font-medium">Lucro</th>
                  <th className="py-2 text-right font-medium">€/km</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {vehicleStats.map((stat) =>
                  stat ? (
                    <tr key={stat.vehicleId}>
                      <td className="py-2 text-ink">{stat.name}</td>
                      <td className="tabular py-2 text-right text-muted">
                        {metresToKmString(stat.metres, 0)}
                      </td>
                      <td className="tabular py-2 text-right text-ink">
                        {formatCents(stat.revenueCents)}
                      </td>
                      <td className="tabular py-2 text-right text-ink">
                        {formatCents(stat.costCents)}
                      </td>
                      <td
                        className={`tabular py-2 text-right font-medium ${
                          stat.profitCents >= 0 ? "text-positive" : "text-negative"
                        }`}
                      >
                        {formatCents(stat.profitCents)}
                      </td>
                      <td className="tabular py-2 text-right text-muted">
                        {stat.costPerKmCents != null
                          ? formatCostPerKm(stat.costPerKmCents)
                          : "—"}
                      </td>
                    </tr>
                  ) : null,
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <p className="text-[11px] leading-relaxed text-faint">
        A exportação em PDF ainda não está feita — está prevista para a fase
        seguinte. O CSV abre no Excel e no LibreOffice.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={`text-sm ${strong ? "font-medium text-ink" : "text-muted"}`}>
        {label}
      </dt>
      <dd
        className={`tabular shrink-0 ${strong ? "text-base font-semibold" : "text-sm"} ${
          tone === "positive"
            ? "text-positive"
            : tone === "negative"
              ? "text-negative"
              : "text-ink"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
