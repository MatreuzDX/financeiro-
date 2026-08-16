"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { guardAction } from "@/server/auth/guard";
import { prisma } from "@/server/db";
import { verifyPassword } from "@/server/auth/password";
import { recordAudit } from "@/server/audit";
import { SESSION_COOKIE } from "@/lib/auth-cookie";

export type ApagarState = { error?: string };

/**
 * Apagar a conta e tudo o que lhe pertence.
 *
 * É o mínimo decente, além de ser exigido pelo RGPD. Três travões, porque
 * isto não se desfaz:
 *
 * 1. Pede a palavra-passe. Um botão que apaga tudo sem confirmar a identidade
 *    é uma bomba à espera de um telemóvel destrancado.
 * 2. Pede que se escreva APAGAR. Um clique acidental não chega.
 * 3. Recusa apagar espaços onde há mais gente, a menos que se saia deles
 *    primeiro — apagar a conta de alguém não pode apagar as contas do casal.
 */
export async function apagarContaAction(
  _prev: ApagarState,
  formData: FormData,
): Promise<ApagarState> {
  const guard = await guardAction("data:read");
  if (!guard.ok) return { error: guard.error };

  if (String(formData.get("confirmacao") ?? "").trim().toUpperCase() !== "APAGAR") {
    return { error: 'Escreva APAGAR em maiúsculas para confirmar.' };
  }

  const utilizador = await prisma.user.findUnique({
    where: { id: guard.session.userId },
    select: { id: true, email: true, passwordHash: true },
  });
  if (!utilizador) return { error: "Conta não encontrada." };

  const senha = String(formData.get("password") ?? "");
  if (!(await verifyPassword(utilizador.passwordHash, senha))) {
    return { error: "Palavra-passe errada." };
  }

  // Espaços onde esta pessoa é a única — só esses é que desaparecem com ela.
  const minhas = await prisma.membership.findMany({
    where: { userId: utilizador.id },
    select: { workspaceId: true },
  });

  const soMeus: string[] = [];
  for (const m of minhas) {
    const quantos = await prisma.membership.count({
      where: { workspaceId: m.workspaceId },
    });
    if (quantos === 1) soMeus.push(m.workspaceId);
  }

  const partilhados = minhas.length - soMeus.length;
  if (partilhados > 0) {
    return {
      error:
        `Ainda pertence a ${partilhados} espaço${partilhados === 1 ? "" : "s"} com ` +
        "outras pessoas. Saia desses espaços primeiro — apagar a sua conta não " +
        "pode apagar as contas de mais ninguém.",
    };
  }

  await recordAudit({
    action: "account.deleted",
    userId: utilizador.id,
    userEmail: utilizador.email,
    metadata: { espacos: soMeus.length },
  });

  await prisma.$transaction(async (tx) => {
    // Os espaços caem em cascata e levam tudo o que lá está dentro.
    await tx.workspace.deleteMany({ where: { id: { in: soMeus } } });
    await tx.session.deleteMany({ where: { userId: utilizador.id } });
    await tx.user.delete({ where: { id: utilizador.id } });
  });

  (await cookies()).delete(SESSION_COOKIE);
  redirect("/entrar?apagada=1");
}
