"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, ErrorBanner, Field, Input } from "@/components/ui";
import { MIN_PASSWORD_LENGTH, PASSWORD_HINT } from "@/lib/password-rules";
import {
  acceptAndRegisterAction,
  joinAction,
  type ConviteState,
} from "./actions";

function Submit({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Um momento…" : children}
    </Button>
  );
}

/** Já tem conta e sessão aberta: um clique. */
export function JoinButton({
  token,
  espaco,
}: {
  token: string;
  espaco: string;
}) {
  const [state, action] = useActionState<ConviteState, FormData>(
    async () => joinAction(token),
    {},
  );

  return (
    <form action={action} className="space-y-3">
      {state.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}
      <Submit>{`Juntar-me a ${espaco}`}</Submit>
    </form>
  );
}

/** Ainda não tem conta: cria-a aqui, com o email do convite. */
export function RegisterAndJoinForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const [state, action] = useActionState<ConviteState, FormData>(
    acceptAndRegisterAction.bind(null, token),
    {},
  );

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error ? <ErrorBanner>{state.error}</ErrorBanner> : null}

      <Field label="Email" hint="Vem do convite e não se pode mudar aqui.">
        <Input value={email} readOnly disabled />
      </Field>

      <Field label="O seu nome">
        <Input
          name="name"
          required
          autoFocus
          maxLength={80}
          autoComplete="name"
          defaultValue={state.values?.name ?? ""}
        />
      </Field>

      <Field label="Palavra-passe" hint={PASSWORD_HINT}>
        <Input
          name="password"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
        />
      </Field>

      <Field label="Repita a palavra-passe">
        <Input
          name="confirm"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
        />
      </Field>

      <Submit>Criar conta e entrar</Submit>
    </form>
  );
}
