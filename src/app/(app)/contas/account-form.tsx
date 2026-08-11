"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, X } from "lucide-react";
import {
  Button,
  ErrorBanner,
  Field,
  Input,
  MoneyInput,
  Select,
  SuccessBanner,
} from "@/components/ui";
import { createAccountAction, type SimpleState } from "./actions";

const TYPES = [
  ["BANK", "Conta bancária"],
  ["CASH", "Dinheiro"],
  ["CARD", "Cartão de crédito"],
  ["SAVINGS", "Poupança"],
  ["INVESTMENT", "Investimento"],
  ["LOAN", "Empréstimo"],
  ["OTHER", "Outra"],
] as const;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "A guardar…" : "Criar conta"}
    </Button>
  );
}

export function AccountForm() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<SimpleState, FormData>(
    createAccountAction,
    {},
  );

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} className="w-full">
        <Plus size={16} aria-hidden />
        Nova conta
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
        <h3 className="text-sm font-semibold text-ink">Nova conta</h3>
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
        <Input name="name" required maxLength={60} placeholder="Conta à ordem" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo">
          <Select name="type" defaultValue="BANK">
            {TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Instituição" hint="Opcional">
          <Input name="institution" maxLength={60} placeholder="Banco" />
        </Field>
      </div>

      <Field
        label="Saldo atual"
        hint="Quanto tem nesta conta agora. É o ponto de partida dos cálculos."
      >
        <MoneyInput name="openingCents" defaultValue="0,00" />
      </Field>

      <SubmitButton />
    </form>
  );
}
