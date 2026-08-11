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
import { createIncomeSourceAction, type SimpleState } from "./actions";

const TYPES = [
  ["SALARY", "Ordenado"],
  ["DELIVERY", "Entregas"],
  ["FREELANCE", "Freelancer"],
  ["BUSINESS", "Negócio"],
  ["RENTAL", "Arrendamento"],
  ["OTHER", "Outra"],
] as const;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "A guardar…" : "Criar fonte"}
    </Button>
  );
}

export function SourceForm() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<SimpleState, FormData>(
    createIncomeSourceAction,
    {},
  );

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} className="w-full">
        <Plus size={16} aria-hidden />
        Nova fonte de rendimento
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
        <h3 className="text-sm font-semibold text-ink">
          Nova fonte de rendimento
        </h3>
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

      <Field label="Nome">
        <Input
          name="name"
          required
          maxLength={60}
          placeholder="Entregas, Trabalho principal…"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo">
          <Select name="type" defaultValue="DELIVERY">
            {TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Âmbito">
          <Select name="scope" defaultValue="BUSINESS">
            <option value="BUSINESS">Profissional</option>
            <option value="PERSONAL">Pessoal</option>
          </Select>
        </Field>
      </div>

      <Field label="Cor" hint="Usada nos gráficos">
        <input
          type="color"
          name="color"
          defaultValue="#10b981"
          className="h-11 w-full cursor-pointer rounded-xl border border-line bg-surface-2 px-2"
        />
      </Field>

      <SubmitButton />
    </form>
  );
}
