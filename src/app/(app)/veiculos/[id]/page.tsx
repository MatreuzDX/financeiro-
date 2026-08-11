import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/server/auth/guard";
import {
  FUEL_TYPE_LABELS,
  VEHICLE_TYPE_LABELS,
  getVehicle,
  listFuelLogs,
  listMileage,
} from "@/server/vehicles";
import { getVehicleStats } from "@/server/reports";
import { listAccounts } from "@/server/accounts";
import { listCategories } from "@/server/categories";
import { resolvePeriod } from "@/lib/period";
import { formatShort, todayIso, toIso } from "@/lib/date";
import { formatCents, formatCostPerKm, metresToKmString } from "@/lib/money";
import {
  Card,
  CardHeader,
  EmptyState,
  InfoNote,
  PageHeader,
} from "@/components/ui";
import { PeriodPicker } from "@/components/period-picker";
import { CategoryDonut } from "@/components/charts";
import { VehicleLogs } from "./vehicle-logs";

export const metadata: Metadata = { title: "Veículo" };

export default async function VeiculoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const query = await searchParams;

  const vehicle = await getVehicle(session.workspaceId, id);
  if (!vehicle) notFound();

  const today = todayIso(session.timezone);
  const period = resolvePeriod({
    periodo: query.periodo,
    de: query.de,
    ate: query.ate,
    today,
  });

  const [stats, mileage, fuel, accounts, expenseCategories] = await Promise.all([
    getVehicleStats(session.workspaceId, id, {
      from: period.from,
      to: period.to,
    }),
    listMileage(session.workspaceId, id, 10),
    listFuelLogs(session.workspaceId, id, 10),
    listAccounts(session.workspaceId),
    listCategories(session.workspaceId, "EXPENSE"),
  ]);

  const fuelCategories = expenseCategories.filter((c) =>
    ["Combustível", "Manutenção", "Reparações", "Outras despesas"].includes(
      c.name,
    ),
  );

  return (
    <div className="space-y-4">
      <Link
        href="/veiculos"
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink"
      >
        <ArrowLeft size={14} aria-hidden />
        Veículos
      </Link>

      <PageHeader
        title={vehicle.name}
        description={`${VEHICLE_TYPE_LABELS[vehicle.type]}${
          vehicle.brand ? ` · ${vehicle.brand}` : ""
        }${vehicle.model ? ` ${vehicle.model}` : ""}${
          vehicle.year ? ` · ${vehicle.year}` : ""
        } · ${FUEL_TYPE_LABELS[vehicle.fuelType]} · ${metresToKmString(
          vehicle.currentMetres,
          0,
        )} km`}
      />

      <PeriodPicker current={period.key} from={period.from} to={period.to} />

      {/* ── Receita → Custos → Lucro, sempre nesta ordem ───────────────── */}
      <Card className="animate-rise">
        <CardHeader title="Neste período" hint={period.label} />
        <dl className="space-y-2">
          <Row label="Recebido com este veículo" value={formatCents(stats?.revenueCents ?? 0)} />
          <Row
            label="Custos do veículo"
            value={`− ${formatCents(stats?.costCents ?? 0)}`}
          />
          <div className="border-t border-line pt-2">
            <Row
              label="Lucro"
              value={formatCents(stats?.profitCents ?? 0)}
              strong
              tone={(stats?.profitCents ?? 0) >= 0 ? "positive" : "negative"}
            />
          </div>
        </dl>
      </Card>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="Quilómetros"
          value={`${metresToKmString(stats?.metres ?? 0)} km`}
        />
        <Stat
          label="Custo por km"
          value={
            stats?.costPerKmCents != null
              ? formatCostPerKm(stats.costPerKmCents)
              : "—"
          }
        />
        <Stat
          label="Combustível"
          value={`${(stats?.fuelLiters ?? 0).toLocaleString("pt-PT", {
            maximumFractionDigits: 1,
          })} L`}
        />
        <Stat
          label="Consumo"
          value={
            stats?.consumptionPer100Km != null
              ? `${stats.consumptionPer100Km.toLocaleString("pt-PT")} L/100 km`
              : "—"
          }
        />
      </div>

      {stats?.costPerKmCents == null ? (
        <InfoNote>
          O custo por quilómetro só aparece quando houver quilómetros
          registados neste período. Não se inventa um número a partir de dados
          que não existem — um custo/km inventado é pior do que nenhum, porque
          leva a decisões erradas.
        </InfoNote>
      ) : null}

      <VehicleLogs
        vehicleId={vehicle.id}
        today={today}
        currentKm={metresToKmString(vehicle.currentMetres, 1)}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        fuelCategories={fuelCategories.map((c) => ({ id: c.id, name: c.name }))}
      />

      <Card>
        <CardHeader title="Custos por categoria" hint={period.label} />
        <CategoryDonut
          data={(stats?.costByCategory ?? []).map((c) => ({
            name: c.name,
            cents: c.cents,
            color: c.color,
          }))}
        />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Últimos quilómetros" />
          {mileage.length === 0 ? (
            <EmptyState
              title="Sem registos de quilometragem"
              description="Registe o conta-quilómetros ao início e ao fim de cada turno."
            />
          ) : (
            <ul className="divide-y divide-line text-xs">
              {mileage.map((log) => (
                <li key={log.id} className="flex items-center gap-2 py-2">
                  <span className="text-muted">{formatShort(toIso(log.date))}</span>
                  <span className="text-faint">
                    {metresToKmString(log.startMetres, 0)} →{" "}
                    {metresToKmString(log.endMetres, 0)}
                  </span>
                  <span className="tabular ml-auto font-medium text-ink">
                    {metresToKmString(log.totalMetres)} km
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Últimos abastecimentos" />
          {fuel.length === 0 ? (
            <EmptyState
              title="Sem abastecimentos"
              description="Registar litros e preço permite saber o consumo real e o custo por quilómetro."
            />
          ) : (
            <ul className="divide-y divide-line text-xs">
              {fuel.map((log) => {
                const liters = log.litersMl / 1000;
                return (
                  <li key={log.id} className="flex items-center gap-2 py-2">
                    <span className="text-muted">
                      {formatShort(toIso(log.date))}
                    </span>
                    <span className="text-faint">
                      {liters.toLocaleString("pt-PT", {
                        maximumFractionDigits: 2,
                      })}{" "}
                      L ·{" "}
                      {(log.pricePerLiterE4 / 10_000).toLocaleString("pt-PT", {
                        minimumFractionDigits: 3,
                      })}{" "}
                      €/L
                    </span>
                    <span className="tabular ml-auto font-medium text-ink">
                      {formatCents(log.totalCents)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
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
        className={`tabular shrink-0 ${
          strong ? "text-lg font-semibold" : "text-sm"
        } ${
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3">
      <p className="text-[10px] text-muted">{label}</p>
      <p className="tabular mt-0.5 text-sm font-semibold text-ink">{value}</p>
    </Card>
  );
}
