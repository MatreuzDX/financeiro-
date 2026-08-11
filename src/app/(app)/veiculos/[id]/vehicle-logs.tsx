"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Fuel, Gauge } from "lucide-react";
import {
  Button,
  ErrorBanner,
  Field,
  Input,
  Select,
  SuccessBanner,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  createFuelAction,
  createMileageAction,
  type SimpleState,
} from "../actions";

type Option = { id: string; name: string };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "A guardar…" : label}
    </Button>
  );
}

/**
 * Dois registos que se fazem de pé, na rua, com uma mão. Por isso: poucos
 * campos, teclado numérico, e o valor calculado à frente dos olhos.
 */
export function VehicleLogs({
  vehicleId,
  today,
  currentKm,
  accounts,
  fuelCategories,
}: {
  vehicleId: string;
  today: string;
  currentKm: string;
  accounts: Option[];
  fuelCategories: Option[];
}) {
  const [tab, setTab] = useState<"km" | "fuel">("km");
  const [mileageState, mileageAction] = useActionState<SimpleState, FormData>(
    createMileageAction,
    {},
  );
  const [fuelState, fuelAction] = useActionState<SimpleState, FormData>(
    createFuelAction,
    {},
  );

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface-2 p-1">
        <button
          type="button"
          onClick={() => setTab("km")}
          aria-pressed={tab === "km"}
          className={cn(
            "flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors",
            tab === "km"
              ? "bg-surface text-ink shadow-[var(--shadow)]"
              : "text-muted hover:text-ink",
          )}
        >
          <Gauge size={15} aria-hidden />
          Quilometragem
        </button>
        <button
          type="button"
          onClick={() => setTab("fuel")}
          aria-pressed={tab === "fuel"}
          className={cn(
            "flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors",
            tab === "fuel"
              ? "bg-surface text-ink shadow-[var(--shadow)]"
              : "text-muted hover:text-ink",
          )}
        >
          <Fuel size={15} aria-hidden />
          Abastecimento
        </button>
      </div>

      {tab === "km" ? (
        <form action={mileageAction} className="space-y-4" noValidate>
          <input type="hidden" name="vehicleId" value={vehicleId} />

          {mileageState.error ? (
            <ErrorBanner>{mileageState.error}</ErrorBanner>
          ) : null}
          {mileageState.success ? (
            <SuccessBanner>{mileageState.success}</SuccessBanner>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Km ao início">
              <Input
                name="startKm"
                inputMode="decimal"
                required
                defaultValue={currentKm}
              />
            </Field>
            <Field label="Km ao fim">
              <Input name="endKm" inputMode="decimal" required />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data">
              <Input type="date" name="date" required defaultValue={today} />
            </Field>
            <Field label="Finalidade">
              <Select name="purpose" defaultValue="WORK">
                <option value="WORK">Trabalho</option>
                <option value="PERSONAL">Pessoal</option>
              </Select>
            </Field>
          </div>

          <SubmitButton label="Registar quilómetros" />
        </form>
      ) : (
        <form action={fuelAction} className="space-y-4" noValidate>
          <input type="hidden" name="vehicleId" value={vehicleId} />

          {fuelState.error ? <ErrorBanner>{fuelState.error}</ErrorBanner> : null}
          {fuelState.success ? (
            <SuccessBanner>{fuelState.success}</SuccessBanner>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Litros">
              <Input
                name="liters"
                inputMode="decimal"
                required
                placeholder="6,5"
              />
            </Field>
            <Field label="Preço por litro" hint="Em euros, até 4 casas">
              <Input
                name="pricePerLiter"
                inputMode="decimal"
                required
                placeholder="1,689"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Quilometragem">
              <Input
                name="odometerKm"
                inputMode="decimal"
                required
                defaultValue={currentKm}
              />
            </Field>
            <Field label="Data">
              <Input type="date" name="date" required defaultValue={today} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pago com" hint="Deixe vazio para não lançar a despesa">
              <Select name="accountId" defaultValue="">
                <option value="">Não lançar despesa</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Categoria">
              <Select
                name="categoryId"
                defaultValue={fuelCategories[0]?.id ?? ""}
              >
                {fuelCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              name="fullTank"
              defaultChecked
              className="h-4 w-4 rounded border-line"
            />
            Enchi o depósito
          </label>

          <SubmitButton label="Registar abastecimento" />
        </form>
      )}
    </div>
  );
}
