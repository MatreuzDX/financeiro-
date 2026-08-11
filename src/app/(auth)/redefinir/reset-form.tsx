"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, ErrorBanner, Field, Input } from "@/components/ui";
import { resetPasswordAction, type FormState } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "A guardar…" : "Guardar palavra-passe"}
    </Button>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState<FormState, FormData>(
    resetPasswordAction,
    {},
  );

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}

      <input type="hidden" name="token" value={token} />

      <Field
        label="Palavra-passe nova"
        hint="Pelo menos 12 caracteres, misturando maiúsculas, minúsculas, números ou símbolos."
      >
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          autoFocus
        />
      </Field>

      <Field label="Repita a palavra-passe">
        <Input
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
        />
      </Field>

      <SubmitButton />
    </form>
  );
}
