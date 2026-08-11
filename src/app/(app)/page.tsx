import Link from "next/link";
import { ArrowRight, Bike, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { requireSession } from "@/server/auth/guard";
import {
  getByCategory,
  getBudgetStatus,
  getEvolution,
  getIncomeBySource,
  getSummary,
  getTotalBalance,
  getVehicleStats,
} from "@/server/reports";
import { listVehicles } from "@/server/vehicles";
import { listTransactions } from "@/server/ledger";
import { resolvePeriod } from "@/lib/period";
import { todayIso, formatRelativeDay } from "@/lib/date";
import {
  formatCents,
  formatCostPerKm,
  metresToKmString,
  percentOf,
} from "@/lib/money";
import {
  Card,
  CardHeader,
  EmptyState,
  LinkButton,
  Money,
  ProgressBar,
} from "@/components/ui";
import { PeriodPicker } from "@/components/period-picker";
import {
  BalanceChart,
  CategoryDonut,
  IncomeExpenseChart,
  SourceBars,
} from "@/components/charts";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireSession();
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
    previousSummary,
    balance,
    evolution,
    expensesByCategory,
    incomeBySource,
    vehicles,
    budget,
    recent,
  ] = await Promise.all([
    getSummary(session.workspaceId, range),
    getSummary(session.workspaceId, period.previous),
    getTotalBalance(session.workspaceId),
    getEvolution(session.workspaceId, period),
    getByCategory(session.workspaceId, range, "EXPENSE"),
    getIncomeBySource(session.workspaceId, range),
    listVehicles(session.workspaceId, true),
    getBudgetStatus(session.workspaceId, today),
    listTransactions(session.workspaceId, range, { take: 5 }),
  ]);

  const vehicle = vehicles[0]
    ? await getVehicleStats(session.workspaceId, vehicles[0].id, range)
    : null;

  const series = evolution.map((p) => ({
    label: p.label,
    incomeCents: p.incomeCents,
    expenseCents: p.expenseCents,
    balanceCents: p.balanceCents,
  }));

  const overBudget = budget.rows.filter((r) => r.over);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            {period.label}
          </h1>
          <p className="text-sm text-muted">
            {summary.netCents >= 0
              ? "Está a sobrar dinheiro neste período."
              : "Está a gastar mais do que a receber neste período."}
          </p>
        </div>
        <PeriodPicker current={period.key} from={period.from} to={period.to} />
      </div>

      {/* ── Saldo total: o número principal, sozinho, sem concorrência ─── */}
      <Card className="animate-rise bg-linear-to-br from-primary-soft to-surface">
        <p className="text-xs font-medium text-muted">Saldo total</p>
        <p className="tabular mt-1 text-4xl font-semibold tracking-tight text-ink">
          {formatCents(balance)}
        </p>
        <p className="mt-1 text-xs text-muted">
          Somado de todas as contas ativas
        </p>
      </Card>

      {/* ── Entrou / Saiu / Sobrou ──────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard
          label="Entrou"
          cents={summary.incomeCents}
          previous={previousSummary.incomeCents}
          tone="positive"
          Icon={TrendingUp}
        />
        <StatCard
          label="Saiu"
          cents={summary.expenseCents}
          previous={previousSummary.expenseCents}
          tone="negative"
          invertTrend
          Icon={TrendingDown}
        />
        <StatCard
          label="Sobrou"
          cents={summary.netCents}
          previous={previousSummary.netCents}
          tone={summary.netCents >= 0 ? "positive" : "negative"}
          Icon={Wallet}
        />
      </div>

      {overBudget.length > 0 ? (
        <Card className="animate-rise border-warning/40 bg-warning-soft">
          <p className="text-sm font-medium text-warning">
            {overBudget.length === 1
              ? "1 categoria acima do orçamento"
              : `${overBudget.length} categorias acima do orçamento`}
          </p>
          <ul className="mt-2 space-y-1 text-xs text-warning">
            {overBudget.slice(0, 3).map((row) => (
              <li key={row.categoryId} className="flex justify-between gap-2">
                <span className="truncate">{row.name}</span>
                <span className="tabular shrink-0">
                  {formatCents(row.spentCents)} de {formatCents(row.plannedCents)}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/orcamento"
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-warning hover:underline"
          >
            Ver orçamento <ArrowRight size={13} aria-hidden />
          </Link>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="animate-rise">
          <CardHeader
            title="Receitas e despesas"
            hint="Comparação ao longo do período"
          />
          <IncomeExpenseChart data={series} />
        </Card>

        <Card className="animate-rise">
          <CardHeader title="Evolução do saldo" hint="Somatório de todas as contas" />
          <BalanceChart data={series} />
        </Card>

        <Card className="animate-rise">
          <CardHeader title="Onde foi o dinheiro" hint="Despesas por categoria" />
          <CategoryDonut
            data={expensesByCategory.map((c) => ({
              name: c.name,
              cents: c.cents,
              color: c.color,
            }))}
          />
        </Card>

        <Card className="animate-rise">
          <CardHeader
            title="De onde veio o dinheiro"
            hint="Receitas por fonte de rendimento"
          />
          <SourceBars
            data={incomeBySource.map((s) => ({
              name: s.name,
              cents: s.cents,
              color: s.color,
            }))}
          />
        </Card>
      </div>

      {/* ── Veículo: receita, custo e LUCRO — nunca só a receita ────────── */}
      {vehicle ? (
        <Card className="animate-rise">
          <CardHeader
            title={vehicle.name}
            hint="Este veículo, neste período"
            action={
              <Link
                href={`/veiculos/${vehicle.vehicleId}`}
                className="text-xs font-medium text-primary hover:underline"
              >
                Detalhes
              </Link>
            }
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Recebido" value={formatCents(vehicle.revenueCents)} />
            <MiniStat label="Custos" value={formatCents(vehicle.costCents)} />
            <MiniStat
              label="Lucro"
              value={formatCents(vehicle.profitCents)}
              tone={vehicle.profitCents >= 0 ? "positive" : "negative"}
            />
            <MiniStat
              label="Custo por km"
              value={
                vehicle.costPerKmCents !== null
                  ? formatCostPerKm(vehicle.costPerKmCents)
                  : "—"
              }
              hint={
                vehicle.costPerKmCents === null
                  ? "Sem quilómetros registados"
                  : `${metresToKmString(vehicle.metres)} km`
              }
            />
          </div>
          {vehicle.costPerKmCents === null ? (
            <p className="mt-3 text-xs text-muted">
              Registe a quilometragem dos trabalhos para saber quanto custa
              cada quilómetro. Enquanto não houver dados, não se inventa um
              número.
            </p>
          ) : null}
        </Card>
      ) : (
        <Card className="animate-rise">
          <CardHeader title="Veículos" />
          <EmptyState
            icon={<Bike size={26} aria-hidden />}
            title="Nenhum veículo registado"
            description="Se usa um veículo para trabalhar, registe-o para saber quanto lhe custa cada quilómetro e quanto lucra de verdade."
            action={
              <LinkButton href="/veiculos" size="sm">
                Adicionar veículo
              </LinkButton>
            }
          />
        </Card>
      )}

      {/* ── Orçamento ───────────────────────────────────────────────────── */}
      <Card className="animate-rise">
        <CardHeader
          title="Orçamento do mês"
          hint={
            budget.plannedTotal > 0
              ? `${formatCents(budget.spentTotal)} de ${formatCents(budget.plannedTotal)}`
              : undefined
          }
          action={
            <Link
              href="/orcamento"
              className="text-xs font-medium text-primary hover:underline"
            >
              Gerir
            </Link>
          }
        />
        {budget.rows.length === 0 ? (
          <EmptyState
            title="Ainda sem orçamento"
            description="Definir quanto quer gastar em cada categoria é a forma mais rápida de perceber onde o dinheiro escapa."
            action={
              <LinkButton href="/orcamento" size="sm">
                Criar orçamento
              </LinkButton>
            }
          />
        ) : (
          <ul className="space-y-3">
            {budget.rows.slice(0, 5).map((row) => (
              <li key={row.categoryId}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-ink">{row.name}</span>
                  <span className="tabular shrink-0 text-muted">
                    {formatCents(row.spentCents)} / {formatCents(row.plannedCents)}
                  </span>
                </div>
                <ProgressBar
                  percent={row.percent}
                  tone={row.over ? "negative" : row.percent > 80 ? "warning" : "primary"}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ── Últimos movimentos ──────────────────────────────────────────── */}
      <Card className="animate-rise">
        <CardHeader
          title="Últimos movimentos"
          action={
            <Link
              href="/movimentos"
              className="text-xs font-medium text-primary hover:underline"
            >
              Ver todos
            </Link>
          }
        />
        {recent.rows.length === 0 ? (
          <EmptyState
            title="Ainda não há movimentos"
            description="Registe a primeira receita ou despesa e o dashboard começa a fazer sentido."
            action={
              <LinkButton href="/movimentos/novo" size="sm">
                Registar movimento
              </LinkButton>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {recent.rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <span
                  className="h-8 w-1 shrink-0 rounded-full"
                  style={{
                    background:
                      row.type === "TRANSFER"
                        ? "var(--muted)"
                        : row.type === "INCOME"
                          ? "var(--positive)"
                          : (row.categoryColor ?? "var(--negative)"),
                  }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{row.description}</p>
                  <p className="truncate text-[11px] text-muted">
                    {formatRelativeDay(row.date, today)}
                    {row.categoryName ? ` · ${row.categoryName}` : ""}
                    {row.type === "TRANSFER" ? " · Transferência" : ""}
                  </p>
                </div>
                <Money
                  cents={row.type === "EXPENSE" ? -row.amountCents : row.amountCents}
                  tone={
                    row.type === "INCOME"
                      ? "positive"
                      : row.type === "EXPENSE"
                        ? "negative"
                        : "plain"
                  }
                  className="shrink-0 text-sm font-medium"
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  label,
  cents,
  previous,
  tone,
  invertTrend = false,
  Icon,
}: {
  label: string;
  cents: number;
  previous: number;
  tone: "positive" | "negative";
  invertTrend?: boolean;
  Icon: typeof Wallet;
}) {
  // A comparação com o período anterior dá contexto de graça. Sem base de
  // comparação (período anterior a zero) não se mostra percentagem nenhuma:
  // "+∞%" não diz nada a ninguém.
  const hasBase = previous !== 0;
  const delta = hasBase ? percentOf(cents - previous, Math.abs(previous)) : 0;
  const good = invertTrend ? delta < 0 : delta > 0;

  return (
    <Card className="animate-rise p-3 sm:p-4">
      <div className="mb-1 flex items-center gap-1.5">
        <Icon size={13} className="text-muted" aria-hidden />
        <p className="truncate text-[11px] font-medium text-muted">{label}</p>
      </div>
      <p
        className={`tabular text-lg font-semibold tracking-tight sm:text-xl ${
          tone === "positive" ? "text-positive" : "text-negative"
        }`}
      >
        {formatCents(cents)}
      </p>
      {hasBase && delta !== 0 ? (
        <p className="mt-1 truncate text-[10px] text-muted">
          <span className={good ? "text-positive" : "text-negative"}>
            {delta > 0 ? "+" : ""}
            {delta}%
          </span>{" "}
          vs anterior
        </p>
      ) : (
        <p className="mt-1 text-[10px] text-faint">sem comparação</p>
      )}
    </Card>
  );
}

function MiniStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p
        className={`tabular mt-0.5 text-sm font-semibold ${
          tone === "positive"
            ? "text-positive"
            : tone === "negative"
              ? "text-negative"
              : "text-ink"
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[10px] text-faint">{hint}</p> : null}
    </div>
  );
}

