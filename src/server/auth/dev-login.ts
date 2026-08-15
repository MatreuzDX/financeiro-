/**
 * Entrada rápida como administrador — SÓ EM DESENVOLVIMENTO.
 *
 * Existe para não ser preciso escrever email e palavra-passe dezenas de
 * vezes por dia a testar. Em produção seria a chave da porta à porta de
 * toda a gente, por isso está fechada a três voltas:
 *
 *   1. `NODE_ENV` tem de ser exatamente "development"
 *   2. `VERCEL` não pode estar definida (a Vercel define-a em TODOS os
 *      ambientes dela, incluindo pré-visualizações)
 *   3. a verificação corre no SERVIDOR, dentro da própria ação
 *
 * O ponto 3 é o que interessa. Esconder o botão no ecrã não protege nada —
 * quem souber o nome da ação chama-a à mesma. A regra é a mesma do resto da
 * app: a decisão vive no servidor.
 */

import "server-only";
import { prisma } from "@/server/db";
import { recordAudit } from "@/server/audit";
import { createSession, setSessionCookie } from "./session";
import { generateStrongPassword } from "./password";
import { createUserWithWorkspace } from "@/server/onboarding";

const DEV_EMAIL = "dev@localhost";

/** A única fonte de verdade sobre se isto pode sequer existir. */
export function devLoginPermitido(): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  if (process.env.VERCEL) return false;
  return true;
}

export type DevLoginResultado =
  | { ok: true; email: string; criado: boolean }
  | { ok: false; error: string };

/**
 * Entra como o primeiro administrador que existir. Se não existir nenhum,
 * cria um de desenvolvimento — assim uma base acabada de criar também
 * funciona ao primeiro clique.
 */
export async function devLogin(meta: {
  ip: string | null;
  userAgent: string | null;
}): Promise<DevLoginResultado> {
  if (!devLoginPermitido()) {
    // Mensagem seca de propósito: em produção isto não deve sequer sugerir
    // que existe uma porta destas.
    return { ok: false, error: "Indisponível." };
  }

  let user = await prisma.user.findFirst({
    where: { role: "OWNER" },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });

  let criado = false;
  if (!user) {
    const novo = await createUserWithWorkspace({
      name: "Administrador (dev)",
      email: DEV_EMAIL,
      // Aleatória e descartável: esta conta entra-se pelo botão, não pela
      // palavra-passe. Nunca fica escrita em lado nenhum.
      password: generateStrongPassword(),
      role: "OWNER",
      workspaceName: "Finanças (desenvolvimento)",
    });
    user = { id: novo.id, email: novo.email };
    criado = true;
  }

  const { token, expiresAt } = await createSession(user.id, meta);
  await setSessionCookie(token, expiresAt);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), mustChangePassword: false },
  });

  await recordAudit({
    action: "auth.login",
    userId: user.id,
    userEmail: user.email,
    metadata: { via: "botão de desenvolvimento", contaCriada: criado },
  });

  return { ok: true, email: user.email, criado };
}
