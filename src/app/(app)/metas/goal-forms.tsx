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
  SuccessBanner,
} from "@/components/ui";
import {
  addContributionAction,
  createGoalAction,
  type GoalState,
} from "./actions";

function Submit({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "A guardar…" : children}
    </Button>
  );
}

export function NewGoalForm({ today }: { today: string }) {
  const [aberto, setAberto] = useState(false);
  const [state, action] = useActionState<GoalState, FormData>(
    createGoalAction,
    {},
  );

  if (!aberto) {
    return (
      <>
        {state.success ? <SuccessBanner>{state.success}</SuccessBanner> : null}
        <Button
          variant="secondary"
          onClick={() => setAberto(true)}
          className="w-full"
        >
          <Plus size={16} aria-hidden />
          Nova meta
        </Button>
      </>
    );
  }

  return (
    <form
      action={action}
      className="animate-rise space-y-4 rounded-2xl border border-line bg-surface p-4"
      noValidate
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Nova meta</h3>
        <button
          type="button"
          onClick={() => setAberto(false)}
          aria-label="Fechar"
          className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-hover"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      {state.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}

      <Field label="Para quê" hint="Fundo de emergência, férias, mota nova…">
        <Input name="name" required maxLength={60} placeholder="Fundo de emergência" />
      </Field>

      <Field label="Quanto quer juntar">
        <MoneyInput name="target" required />
      </Field>

      <Field
        label="Até quando"
        hint="Opcional. Com prazo, a app diz quanto tem de pôr por mês."
      >
        <Input type="date" name="deadline" min={today} />
      </Field>

      <Submit>Criar meta</Submit>
    </form>
  );
}

export function ContributionForm({
  goalId,
  goalName,
  today,
}: {
  goalId: string;
  goalName: string;
  today: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [state, action] = useActionState<GoalState, FormData>(
    addContributionAction,
    {},
  );

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="text-xs font-medium text-primary hover:underline"
      >
        Pôr dinheiro de lado
      </button>
    );
  }

  return (
    <form action={action} className="animate-rise mt-3 space-y-3">
      {state.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}

      <input type="hidden" name="goalId" value={goalId} />

      <div className="flex items-end gap-2">
        <div className="w-32 shrink-0">
          <Field label="Valor">
            <MoneyInput name="amount" required autoFocus />
          </Field>
        </div>
        <div className="min-w-0 flex-1">
          <Field label="Data">
            <Input type="date" name="date" required defaultValue={today} />
          </Field>
        </div>
      </div>

      <p className="text-[11px] text-faint">
        Para tirar dinheiro de {goalName}, escreva um valor negativo — por
        exemplo −50.
      </p>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setAberto(false)}
        >
          Cancelar
        </Button>
        <div className="flex-1">
          <Submit>Registar</Submit>
        </div>
      </div>
    </form>
  );
}
