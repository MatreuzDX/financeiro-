/**
 * Espaços partilhados: casal, família, negócio.
 *
 * A base já estava preparada — `workspaceId` em todas as tabelas e
 * `Membership` com papéis desde o primeiro dia. O que faltava era a porta:
 * convidar, aceitar, trocar de espaço.
 *
 * MODELO MENTAL: um espaço é uma carteira comum. Quem lá está vê tudo o que
 * lá está — os saldos, os movimentos, os gráficos. Não há "as minhas
 * despesas privadas" dentro de um espaço partilhado: se for para ser
 * privado, faz-se noutro espaço. É mais honesto assim do que prometer
 * privacidade a meio.
 *
 * Cada pessoa pode pertencer a vários: "Nós os dois", "Casa", "A loja".
 */

import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { prisma } from "@/server/db";
import { recordAudit } from "@/server/audit";
import { randomToken } from "@/server/auth/password";
import { seedDefaultCategories } from "@/server/onboarding";
import type { SessionUser } from "@/server/auth/session";

const INVITE_TTL_DIAS = 14;

function sha256(v: string) {
  return createHash("sha256").update(v).digest("hex");
}

export const workspaceInput = z.object({
  name: z.string().trim().min(1, "Dê um nome ao espaço").max(60),
});

export const inviteInput = z.object({
  email: z.string().trim().email("Escreva um email válido").max(160),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
});

export const ROLE_EXPLICACAO: Record<Role, string> = {
  OWNER: "Manda em tudo, incluindo apagar o espaço",
  ADMIN: "Faz tudo menos apagar o espaço",
  MEMBER: "Regista e edita movimentos",
  VIEWER: "Só vê — não altera nada",
};

/** Todos os espaços a que a pessoa pertence. */
export async function listMyWorkspaces(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          _count: { select: { memberships: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    role: m.role,
    membros: m.workspace._count.memberships,
  }));
}

export async function listMembers(workspaceId: string) {
  const [membros, convites] = await Promise.all([
    prisma.membership.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invite.findMany({
      where: { workspaceId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { membros, convites };
}

export async function createWorkspace(session: SessionUser, raw: unknown) {
  const input = workspaceInput.parse(raw);

  const workspace = await prisma.workspace.create({
    data: {
      name: input.name,
      memberships: { create: { userId: session.userId, role: "OWNER" } },
    },
  });

  await seedDefaultCategories(workspace.id);

  await recordAudit({
    action: "workspace.created",
    workspaceId: workspace.id,
    userId: session.userId,
    userEmail: session.email,
    metadata: { name: workspace.name },
  });

  return workspace;
}

/** Troca o espaço ativo. Só entre espaços de que a pessoa é membro. */
export async function switchWorkspace(session: SessionUser, workspaceId: string) {
  const pertence = await prisma.membership.count({
    where: { userId: session.userId, workspaceId },
  });
  if (pertence === 0) throw new Error("Não pertence a esse espaço.");

  await prisma.user.update({
    where: { id: session.userId },
    data: { activeWorkspaceId: workspaceId },
  });
}

/**
 * Cria um convite e devolve o LINK.
 *
 * Não envia email — não há serviço configurado, e dizê-lo é melhor do que
 * fingir. Quem convida copia o link e manda-o por onde quiser.
 */
export async function inviteMember(
  session: SessionUser,
  raw: unknown,
  appUrl: string,
): Promise<{ link: string; email: string }> {
  const input = inviteInput.parse(raw);
  const email = input.email.toLowerCase();

  const jaEMembro = await prisma.membership.findFirst({
    where: { workspaceId: session.workspaceId, user: { email } },
    select: { id: true },
  });
  if (jaEMembro) throw new Error("Essa pessoa já está neste espaço.");

  // Um convite pendente por email: pedir outra vez substitui o anterior, em
  // vez de encher a lista de links que já ninguém sabe quais são.
  await prisma.invite.deleteMany({
    where: { workspaceId: session.workspaceId, email, acceptedAt: null },
  });

  const token = randomToken(32);
  await prisma.invite.create({
    data: {
      workspaceId: session.workspaceId,
      email,
      role: input.role,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + INVITE_TTL_DIAS * 86_400_000),
      invitedById: session.userId,
    },
  });

  await recordAudit({
    action: "member.invited",
    workspaceId: session.workspaceId,
    userId: session.userId,
    userEmail: session.email,
    metadata: { convidado: email, papel: input.role },
  });

  return { link: `${appUrl}/convite/${token}`, email };
}

export type ConviteAberto = {
  id: string;
  email: string;
  role: Role;
  workspaceId: string;
  workspaceName: string;
};

/** Lê um convite pelo token. `null` se não existir, expirou ou já foi usado. */
export async function lerConvite(token: string): Promise<ConviteAberto | null> {
  const convite = await prisma.invite.findUnique({
    where: { tokenHash: sha256(token) },
    include: { workspace: { select: { id: true, name: true } } },
  });

  if (!convite) return null;
  if (convite.acceptedAt) return null;
  if (convite.expiresAt.getTime() < Date.now()) return null;

  return {
    id: convite.id,
    email: convite.email,
    role: convite.role,
    workspaceId: convite.workspace.id,
    workspaceName: convite.workspace.name,
  };
}

/** Junta uma conta existente ao espaço do convite. */
export async function aceitarConvite(
  token: string,
  userId: string,
): Promise<{ workspaceId: string; workspaceName: string }> {
  const convite = await lerConvite(token);
  if (!convite) throw new Error("Este convite já não é válido.");

  await prisma.$transaction(async (tx) => {
    const jaLaEsta = await tx.membership.count({
      where: { userId, workspaceId: convite.workspaceId },
    });
    if (jaLaEsta === 0) {
      await tx.membership.create({
        data: { userId, workspaceId: convite.workspaceId, role: convite.role },
      });
    }
    await tx.invite.update({
      where: { id: convite.id },
      data: { acceptedAt: new Date() },
    });
    // Entra logo a ver o espaço novo — é para lá que a pessoa quer ir.
    await tx.user.update({
      where: { id: userId },
      data: { activeWorkspaceId: convite.workspaceId },
    });
  });

  const utilizador = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  await recordAudit({
    action: "member.joined",
    workspaceId: convite.workspaceId,
    userId,
    userEmail: utilizador?.email ?? null,
    metadata: { papel: convite.role },
  });

  return {
    workspaceId: convite.workspaceId,
    workspaceName: convite.workspaceName,
  };
}

/**
 * Tira alguém do espaço.
 *
 * Nunca se pode remover o último proprietário: um espaço sem dono fica sem
 * ninguém que o possa gerir ou apagar.
 */
export async function removeMember(session: SessionUser, membershipId: string) {
  const alvo = await prisma.membership.findFirst({
    where: { id: membershipId, workspaceId: session.workspaceId },
    include: { user: { select: { email: true } } },
  });
  if (!alvo) throw new Error("Membro não encontrado.");

  if (alvo.role === "OWNER") {
    const donos = await prisma.membership.count({
      where: { workspaceId: session.workspaceId, role: "OWNER" },
    });
    if (donos <= 1) {
      throw new Error(
        "Não pode sair o único proprietário. Passe a propriedade a outra pessoa primeiro.",
      );
    }
  }

  await prisma.membership.delete({ where: { id: membershipId } });

  await recordAudit({
    action: "member.removed",
    workspaceId: session.workspaceId,
    userId: session.userId,
    userEmail: session.email,
    metadata: { removido: alvo.user.email },
  });
}

export async function changeMemberRole(
  session: SessionUser,
  membershipId: string,
  role: Role,
) {
  const alvo = await prisma.membership.findFirst({
    where: { id: membershipId, workspaceId: session.workspaceId },
    include: { user: { select: { email: true } } },
  });
  if (!alvo) throw new Error("Membro não encontrado.");

  if (alvo.role === "OWNER" && role !== "OWNER") {
    const donos = await prisma.membership.count({
      where: { workspaceId: session.workspaceId, role: "OWNER" },
    });
    if (donos <= 1) {
      throw new Error("Tem de haver sempre pelo menos um proprietário.");
    }
  }

  await prisma.membership.update({ where: { id: membershipId }, data: { role } });

  await recordAudit({
    action: "member.role_changed",
    workspaceId: session.workspaceId,
    userId: session.userId,
    userEmail: session.email,
    metadata: { pessoa: alvo.user.email, de: alvo.role, para: role },
  });
}

export async function cancelInvite(session: SessionUser, inviteId: string) {
  const convite = await prisma.invite.findFirst({
    where: { id: inviteId, workspaceId: session.workspaceId },
  });
  if (!convite) return;
  await prisma.invite.delete({ where: { id: inviteId } });

  await recordAudit({
    action: "member.invite_cancelled",
    workspaceId: session.workspaceId,
    userId: session.userId,
    userEmail: session.email,
    metadata: { convidado: convite.email },
  });
}
