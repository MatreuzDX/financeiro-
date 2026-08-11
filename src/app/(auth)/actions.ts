"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import {
  completePasswordReset,
  login,
  requestPasswordReset,
} from "@/server/auth/service";

export type FormState = {
  error?: string;
  success?: string;
  /** Valores a repor no formulário — errar uma vez não deve apagar tudo. */
  values?: Record<string, string>;
};

async function clientMeta() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return {
    ip: forwarded?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null,
    userAgent: h.get("user-agent"),
  };
}

/** Só aceita caminhos internos — senão vira um redirecionamento aberto. */
function safeNext(value: string | null): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("seguinte") ?? "") || null);

  const meta = await clientMeta();
  const result = await login({ email, password, ...meta });

  if (!result.ok) {
    // Devolver o email preenchido: quem se engana na palavra-passe não deve
    // ter de reescrever tudo.
    return { error: result.error, values: { email } };
  }

  redirect(next);
}

export async function requestResetAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  if (!email.includes("@")) {
    return { error: "Escreva um email válido.", values: { email } };
  }

  const meta = await clientMeta();
  const result = await requestPasswordReset({
    email,
    ip: meta.ip,
    appUrl: env().NEXT_PUBLIC_APP_URL,
  });

  if (!result.ok) return { error: result.error, values: { email } };

  if (result.devLink) {
    return {
      success:
        "Em desenvolvimento não se envia email: o link de recuperação foi escrito no terminal do servidor.",
    };
  }

  return {
    success:
      "Se existir uma conta com esse email, foi criado um pedido de recuperação.",
  };
}

export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password !== confirm) {
    return { error: "As duas palavras-passe não são iguais." };
  }

  const result = await completePasswordReset({ token, newPassword: password });
  if (!result.ok) return { error: result.error };

  redirect("/entrar?redefinida=1");
}
