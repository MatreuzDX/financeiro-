"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { appUrl } from "@/lib/env";
import { recordAudit } from "@/server/audit";
import { checkPasswordStrength } from "@/server/auth/password";
import { createSession, setSessionCookie } from "@/server/auth/session";
import { createFirstOwner, hasAnyUser } from "@/server/onboarding";
import { devLogin } from "@/server/auth/dev-login";
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

/**
 * Cria a primeira conta. Só funciona enquanto a aplicação não tiver
 * nenhuma — depois disso esta ação recusa sempre.
 */
export async function installAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const values = { name, email };

  if (name.length < 2) {
    return { error: "Escreva o seu nome.", values };
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "Escreva um email válido.", values };
  }
  if (password !== confirm) {
    return { error: "As duas palavras-passe não são iguais.", values };
  }

  const problems = checkPasswordStrength(password);
  if (problems.length > 0) return { error: problems.join(" "), values };

  if (await hasAnyUser()) {
    return {
      error: "Esta aplicação já está configurada. Entre com a sua conta.",
      values,
    };
  }

  let userId: string;
  let workspaceId: string;
  try {
    const user = await createFirstOwner({ name, email, password });
    userId = user.id;
    workspaceId = user.workspaceId;
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível criar a conta.",
      values,
    };
  }

  // Entra logo, para não haver um passo extra a seguir.
  const meta = await clientMeta();
  const { token, expiresAt } = await createSession(userId, meta);
  await setSessionCookie(token, expiresAt);

  await recordAudit({
    action: "admin.created",
    userId,
    userEmail: email,
    workspaceId,
    metadata: { via: "instalacao inicial" },
  });

  // Não vai para o dashboard: vai para as perguntas. Um primeiro ecrã todo
  // vazio, sem nada onde clicar, é a forma mais rápida de alguém desistir.
  redirect("/comecar");
}

/**
 * Entrada rápida de desenvolvimento.
 *
 * A verificação vive em `devLogin`, no servidor — não aqui, e muito menos
 * no ecrã. Se alguém chamar esta ação num ambiente que não seja localhost,
 * leva com "Indisponível." e mais nada.
 */
export async function devLoginAction(): Promise<void> {
  const meta = await clientMeta();
  const resultado = await devLogin(meta);
  // Devolve `void` porque é usada num <form> simples, sem estado. Se for
  // recusada — fora de localhost — volta ao login sem dizer porquê, que é
  // o comportamento certo para uma porta que ali não devia existir.
  if (!resultado.ok) redirect("/entrar");
  redirect("/");
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
    appUrl: appUrl(),
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
