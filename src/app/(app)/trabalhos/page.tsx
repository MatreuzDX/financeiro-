import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { requireSession } from "@/server/auth/guard";
import { PAY_MODEL_LABELS, listWorkJobs } from "@/server/work";
import { listIncomeSources } from "@/server/income-sources";
import { listVehicles } from "@/server/vehicles";
import { listAccounts } from "@/server/accounts";
import { listCategories } from "@/server/categories";
import { getVehicleStats } from "@/server/reports";
import { resolvePeriod } from "@/lib/period";
import { formatShort, todayIso } from "@/lib/date";
import { formatCents, metresToKmString } from "@/lib/money";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { PeriodPicker } from "@/components/period-picker";
import { WorkForm } from "./work-form";
import { deleteWorkJobAction } from "./actions";

export const metadata: Metadata = { title: "Trabalhos" };

export default async function TrabalhosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireSession("/trabalhos");
  const params = await searchParams;
  const today = todayIso(session.timezone);
  const period = resolvePeriod({
    periodo: params.periodo,
    de: params.de,
    ate: params.ate,
    today,
  });
  const range = { from: period.from, to: period.to };

  const [jobs, sources, vehicles, accounts, incomeCategories] =
    await Promise.all([
      listWorkJobs(session.workspaceId, range),
      listIncomeSources(session.workspaceId, true),
      listVehicles(session.workspaceId, true),
      listAccounts(session.workspaceId),
      listCategories(session.workspaceId, "INCOME"),
    ]);

  // O custo/km vem do veículo principal, calculado sobre o mesmo período.
  const mainVehicleStats = vehicles[0]
    ? await getVehicleStats(session.workspaceId, vehicles[0].id, range)
    : null;

  const totalGross = jobs.reduce((sum, j) => sum + j.grossCents, 0);
  const totalMetres = jobs.reduce((sum, j) => sum + j.distanceMetres, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Trabalhos"
        description="Turnos, entregas e serviços — com o lucro real, não só o que recebeu."
      />

      <PeriodPicker current={period.key} from={period.from} to={period.to} />

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Trabalhos" value={String(jobs.length)} />
        <Stat label="Recebido" value={formatCents(totalGross)} />
        <Stat label="Quilómetros" value={`${metresToKmString(totalMetres, 0)} km`} />
      </div>

      <WorkForm
        incomeSources={sources.map((s) => ({ id: s.id, name: s.name }))}
        vehicles={vehicles.map((v) => ({ id: v.id, name: v.name }))}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        incomeCategories={incomeCategories.map((c) => ({
          id: c.id,
          name: c.name,
        }))}
        today={today}
        costPerKmCents={mainVehicleStats?.costPerKmCents ?? null}
      />

      {jobs.length === 0 ? (
        <Card>
          <EmptyState
            title="Sem trabalhos neste período"
            description="Registe um turno: indique os quilómetros e o valor por quilómetro, e a receita entra sozinha no balanço."
          />
        </Card>
      ) : (
        <ul className="space-y-2">
          {jobs.map((job) => (
            <li key={job.id}>
              <Card className="flex items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {job.clientName}
                  </p>
                  <p className="truncate text-[11px] text-muted">
                    {formatShort(job.date)} · {job.incomeSourceName} ·{" "}
                    {PAY_MODEL_LABELS[job.payModel]}
                    {job.payModel === "PER_KM" && job.distanceMetres > 0
                      ? ` · ${metresToKmString(job.distanceMetres)} km × ${formatCents(job.ratePerKmCents)}/km`
                      : ""}
                    {job.payModel === "PER_DELIVERY"
                      ? ` · ${job.deliveries} entregas`
                      : ""}
                    {job.vehicleName ? ` · ${job.vehicleName}` : ""}
                  </p>
                </div>
                <p className="tabular shrink-0 text-sm font-semibold text-positive">
                  {formatCents(job.grossCents)}
                </p>
                <form action={deleteWorkJobAction} className="shrink-0">
                  <input type="hidden" name="id" value={job.id} />
                  <button
                    type="submit"
                    title="Apagar trabalho e a receita que gerou"
                    aria-label={`Apagar trabalho ${job.clientName}`}
                    className="grid h-8 w-8 place-items-center rounded-lg text-faint transition-colors hover:bg-negative-soft hover:text-negative"
                  >
                    <Trash2 size={15} aria-hidden />
                  </button>
                </form>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="tabular mt-0.5 text-sm font-semibold text-ink">{value}</p>
    </Card>
  );
}
