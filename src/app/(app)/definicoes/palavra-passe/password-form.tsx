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
import { changePasswordAction, type PasswordState } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? "A guardar…" : "Alterar palavra-passe"}
    </Button>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState<PasswordState, FormData>(
    changePasswordAction,
    {},
  );

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}
      {state.success ? <SuccessBanner>{state.success}</SuccessBanner> : null}

      <Field label="Palavra-passe atual">
        <Input
          name="current"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <Field
        label="Palavra-passe nova"
        hint="Pelo menos 12 caracteres, misturando maiúsculas, minúsculas, números ou símbolos."
      >
        <Input
          name="next"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
        />
      </Field>

      <Field label="Repita a nova">
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
