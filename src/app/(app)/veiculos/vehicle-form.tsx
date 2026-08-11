"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, X } from "lucide-react";
import {
  Button,
  ErrorBanner,
  Field,
  Input,
  Select,
  SuccessBanner,
} from "@/components/ui";
import { createVehicleAction, type SimpleState } from "./actions";

const TYPES = [
  ["MOTORCYCLE", "Mota"],
  ["SCOOTER", "Scooter"],
  ["CAR", "Carro"],
  ["VAN", "Carrinha"],
  ["BICYCLE", "Bicicleta"],
  ["OTHER", "Outro"],
] as const;

const FUELS = [
  ["PETROL", "Gasolina"],
  ["DIESEL", "Gasóleo"],
  ["ELECTRIC", "Elétrico"],
  ["HYBRID", "Híbrido"],
  ["LPG", "GPL"],
  ["NONE", "Não aplicável"],
] as const;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "A guardar…" : "Criar veículo"}
    </Button>
  );
}

export function VehicleForm() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<SimpleState, FormData>(
    createVehicleAction,
    {},
  );

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} className="w-full">
        <Plus size={16} aria-hidden />
        Novo veículo
      </Button>
    );
  }

  return (
    <form
      action={action}
      className="animate-rise space-y-4 rounded-2xl border border-line bg-surface p-4"
      noValidate
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Novo veículo</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Fechar"
          className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-hover"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      {state.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}
      {state.success ? <SuccessBanner>{state.success}</SuccessBanner> : null}

      <Field label="Nome" hint="Como lhe chama no dia a dia">
        <Input name="name" required maxLength={60} placeholder="Honda PCX" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Marca">
          <Input name="brand" maxLength={40} placeholder="Honda" />
        </Field>
        <Field label="Modelo">
          <Input name="model" maxLength={40} placeholder="PCX 125" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ano">
          <Input
            name="year"
            type="number"
            inputMode="numeric"
            min={1900}
            max={new Date().getFullYear() + 1}
            placeholder="2016"
          />
        </Field>
        <Field label="Matrícula" hint="Opcional">
          <Input name="plate" maxLength={15} placeholder="00-AA-00" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo">
          <Select name="type" defaultValue="SCOOTER">
            {TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Combustível">
          <Select name="fuelType" defaultValue="PETROL">
            {FUELS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Quilometragem atual" hint="O que marca o conta-quilómetros hoje">
        <Input
          name="currentKm"
          inputMode="decimal"
          defaultValue="0"
          placeholder="24150"
        />
      </Field>

      <SubmitButton />
    </form>
  );
}
