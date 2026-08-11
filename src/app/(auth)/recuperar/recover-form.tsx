"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  Button,
  ErrorBanner,
  Field,
  Input,
  SuccessBanner,
} from "@/components/ui";
import { requestResetAction, type FormState } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "A enviar…" : "Recuperar acesso"}
    </Button>
  );
}

export function RecoverForm() {
  const [state, action] = useActionState<FormState, FormData>(
    requestResetAction,
    {},
  );

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}
      {state.success ? <SuccessBanner>{state.success}</SuccessBanner> : null}

      <Field label="Email">
        <Input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          required
          autoFocus
          defaultValue={state.values?.email ?? ""}
          placeholder="pessoa@exemplo.com"
        />
      </Field>

      <SubmitButton />
    </form>
  );
}
