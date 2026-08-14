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
import { MIN_PASSWORD_LENGTH, PASSWORD_HINT } from "@/lib/password-rules";
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
        hint={PASSWORD_HINT}
      >
        <Input
          name="next"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
        />
      </Field>

      <Field label="Repita a nova">
        <Input
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
        />
      </Field>

      <SubmitButton />
    </form>
  );
}
