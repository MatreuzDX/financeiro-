"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ErrorBanner, Field, Input } from "@/components/ui";
import { apagarContaAction, type ApagarState } from "./actions";

function Apagar({ pronto }: { pronto: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || !pronto}
      className="h-11 w-full rounded-xl bg-negative text-sm font-medium text-white disabled:opacity-40"
    >
      {pending ? "A apagar…" : "Apagar a conta para sempre"}
    </button>
  );
}

export function ApagarForm() {
  const [state, action] = useActionState<ApagarState, FormData>(
    apagarContaAction,
    {},
  );
  const [confirmacao, setConfirmacao] = useState("");

  return (
    <form
      action={action}
      className="space-y-4 rounded-2xl border border-negative/30 bg-negative-soft p-4"
      noValidate
    >
      {state.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}

      <Field
        label="A sua palavra-passe"
        hint="Para garantir que é mesmo você, e não alguém com o telemóvel na mão"
      >
        <Input name="password" type="password" required autoComplete="current-password" />
      </Field>

      <Field label="Escreva APAGAR para confirmar">
        <Input
          name="confirmacao"
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          autoComplete="off"
          placeholder="APAGAR"
        />
      </Field>

      <Apagar pronto={confirmacao.trim().toUpperCase() === "APAGAR"} />
    </form>
  );
}
