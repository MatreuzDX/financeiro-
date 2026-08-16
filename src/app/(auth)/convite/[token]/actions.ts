"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { aceitarConvite, lerConvite } from "@/server/workspaces";
import { checkPasswordStrength, hashPassword } from "@/server/auth/password";
import {
  createSession,
  getSession,
  setSessionCookie,
} from "@/server/auth/session";
import { recordAudit } from "@/server/audit";

export type ConviteState = { error?: string; values?: { name?: string } };

async function clientMeta() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return {
    ip: forwarded?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null,
    userAgent: h.get("user-agent"),
  };
}

/** Quem já tem sessão: um clique e entra no espaço. */
export async function joinAction(token: string): Promise<ConviteState> {
  const session = await getSession();
  if (!session) return { error: "A sua sessão expirou. Entre novamente." };

  try {
    await aceitarConvite(token, session.userId);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível entrar.",
    };
  }

  redirect("/?bemvindo=1");
}

/**
 * Quem ainda não tem conta cria-a aqui.
 *
 * É a única outra porta de criação de contas além da instalação inicial — e
 * está fechada a quem não tiver um convite válido na mão. O email vem do
 * convite e NÃO é aceite do formulário: senão, um convite para uma pessoa
 * servia para criar conta com o email de outra.
 */
export async function acceptAndRegisterAction(
  token: string,
  _prev: ConviteState,
  formData: FormData,
): Promise<ConviteState> {
  const convite = await lerConvite(token);
  if (!convite) return { error: "Este convite já não é válido." };

  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const values = { name };

  if (name === "") return { error: "Escreva o seu nome.", values };
  if (password !== confirm) {
    return { error: "As duas palavras-passe não são iguais.", values };
  }
  const problemas = checkPasswordStrength(password);
  if (problemas.length > 0) return { error: problemas.join(" "), values };

  const jaExiste = await prisma.user.findUnique({
    where: { email: convite.email },
    select: { id: true },
  });
  if (jaExiste) {
    return {
      error: "Já existe uma conta com este email. Entre e abra o link outra vez.",
      values,
    };
  }

  const user = await prisma.user.create({
    data: {
      name,
      email: convite.email,
      passwordHash: await hashPassword(password),
      // Papel global fica MEMBER; o que manda é o papel no espaço.
      role: "MEMBER",
    },
  });

  await aceitarConvite(token, user.id);

  const meta = await clientMeta();
  const { token: sessionToken, expiresAt } = await createSession(user.id, meta);
  await setSessionCookie(sessionToken, expiresAt);

  await recordAudit({
    action: "auth.login",
    userId: user.id,
    userEmail: user.email,
    workspaceId: convite.workspaceId,
    metadata: { via: "convite" },
  });

  redirect("/?bemvindo=1");
}
