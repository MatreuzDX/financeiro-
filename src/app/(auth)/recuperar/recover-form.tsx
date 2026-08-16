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

  // Recuperação de emergência: o link aparece aqui, para se abrir já.
  if (state.success === "emergencia" && state.link) {
    return (
      <div className="animate-rise space-y-3 rounded-2xl border border-primary/30 bg-primary-soft p-4">
        <p className="text-sm font-medium text-primary">
          Link de recuperação criado
        </p>
        <p className="text-xs leading-relaxed text-primary/80">
          Abra-o e escolha uma palavra-passe nova. Vale{" "}
          <strong>uma hora</strong> e serve <strong>uma vez</strong>.
        </p>
        <a
          href={state.link}
          className="block truncate rounded-xl border border-line bg-surface px-3 py-2.5 text-xs text-primary underline"
        >
          {state.link}
        </a>
        <p className="text-[11px] leading-relaxed text-primary/70">
          Depois de entrar, apague a variável <code>RECOVERY_EMAIL</code> das
          definições do servidor. Enquanto ela existir, qualquer pessoa que
          saiba este email consegue pedir um link destes.
        </p>
      </div>
    );
  }

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
