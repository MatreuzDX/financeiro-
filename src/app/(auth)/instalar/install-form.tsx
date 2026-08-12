"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, ErrorBanner, Field, Input } from "@/components/ui";
import { installAction, type FormState } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "A criar…" : "Criar conta e entrar"}
    </Button>
  );
}

export function InstallForm() {
  const [state, action] = useActionState<FormState, FormData>(
    installAction,
    {},
  );

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}

      <Field label="Nome">
        <Input
          name="name"
          required
          autoFocus
          maxLength={80}
          autoComplete="name"
          defaultValue={state.values?.name ?? ""}
          placeholder="Mateus"
        />
      </Field>

      <Field label="Email">
        <Input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          required
          defaultValue={state.values?.email ?? ""}
          placeholder="pessoa@exemplo.com"
        />
      </Field>

      <Field
        label="Palavra-passe"
        hint="Pelo menos 12 caracteres, misturando maiúsculas, minúsculas, números ou símbolos."
      >
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
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
