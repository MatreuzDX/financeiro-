import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireSession } from "@/server/auth/guard";
import {
  FUEL_TYPE_LABELS,
  VEHICLE_TYPE_LABELS,
  listVehicles,
} from "@/server/vehicles";
import { getVehicleStats } from "@/server/reports";
import { resolvePeriod } from "@/lib/period";
import { todayIso } from "@/lib/date";
import { formatCents, formatCostPerKm, metresToKmString } from "@/lib/money";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { PeriodPicker } from "@/components/period-picker";
import { VehicleForm } from "./vehicle-form";

export const metadata: Metadata = { title: "Veículos" };

export default async function VeiculosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireSession("/veiculos");
  const params = await searchParams;
  const today = todayIso(session.timezone);
  const period = resolvePeriod({
    periodo: params.periodo,
    de: params.de,
    ate: params.ate,
    today,
  });

  const vehicles = await listVehicles(session.workspaceId);
  const stats = await Promise.all(
    vehicles.map((v) =>
      getVehicleStats(session.workspaceId, v.id, {
        from: period.from,
        to: period.to,
      }),
    ),
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Veículos"
        description="Quanto custa cada quilómetro, e quanto sobra depois disso."
      />

      <PeriodPicker current={period.key} from={period.from} to={period.to} />

      <VehicleForm />

      {vehicles.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhum veículo registado"
            description="Registe o veículo que usa para trabalhar. Com a quilometragem e os abastecimentos, a app calcula quanto custa cada quilómetro — e quanto lucra de verdade."
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {vehicles.map((vehicle, i) => {
            const stat = stats[i];
            return (
              <li key={vehicle.id}>
                <Link href={`/veiculos/${vehicle.id}`} className="block">
                  <Card className="transition-colors hover:bg-surface-hover">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">
                          {vehicle.name}
                        </p>
                        <p className="truncate text-[11px] text-muted">
                          {VEHICLE_TYPE_LABELS[vehicle.type]}
                          {vehicle.year ? ` · ${vehicle.year}` : ""} ·{" "}
                          {FUEL_TYPE_LABELS[vehicle.fuelType]} ·{" "}
                          {metresToKmString(vehicle.currentMetres, 0)} km
                        </p>
                      </div>
                      <ChevronRight
                        size={18}
                        className="shrink-0 text-faint"
                        aria-hidden
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Cell label="Recebido" value={formatCents(stat?.revenueCents ?? 0)} />
                      <Cell label="Custos" value={formatCents(stat?.costCents ?? 0)} />
                      <Cell
                        label="Lucro"
                        value={formatCents(stat?.profitCents ?? 0)}
                        tone={(stat?.profitCents ?? 0) >= 0 ? "positive" : "negative"}
                      />
                      <Cell
                        label="Custo/km"
                        value={
                          stat?.costPerKmCents != null
                            ? formatCostPerKm(stat.costPerKmCents)
                            : "sem dados"
                        }
                      />
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Cell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="rounded-xl bg-surface-2 p-2.5">
      <p className="text-[10px] text-muted">{label}</p>
      <p
        className={`tabular mt-0.5 text-xs font-semibold ${
          tone === "positive"
            ? "text-positive"
            : tone === "negative"
              ? "text-negative"
              : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
