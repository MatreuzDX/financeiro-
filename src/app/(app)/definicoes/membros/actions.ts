"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { guardAction } from "@/server/auth/guard";
import { appUrl } from "@/lib/env";
import {
  cancelInvite,
  changeMemberRole,
  createWorkspace,
  inviteMember,
  removeMember,
  switchWorkspace,
} from "@/server/workspaces";

export type MembrosState = {
  error?: string;
  /** O link do convite, para copiar e enviar. Não há envio de email. */
  convite?: { link: string; email: string };
};

function mensagem(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Dados inválidos.";
  }
  return error instanceof Error ? error.message : "Não foi possível guardar.";
}

export async function inviteMemberAction(
  _prev: MembrosState,
  formData: FormData,
): Promise<MembrosState> {
  // Convidar mexe em quem tem acesso ao dinheiro. Só administração.
  const guard = await guardAction("admin:users");
  if (!guard.ok) return { error: guard.error };

  try {
    const convite = await inviteMember(
      guard.session,
      {
        email: String(formData.get("email") ?? ""),
        role: String(formData.get("role") ?? "MEMBER"),
      },
      appUrl(),
    );
    revalidatePath("/definicoes/membros");
    return { convite };
  } catch (error) {
    return { error: mensagem(error) };
  }
}

export async function createWorkspaceAction(
  _prev: MembrosState,
  formData: FormData,
): Promise<MembrosState> {
  const guard = await guardAction("data:write");
  if (!guard.ok) return { error: guard.error };

  try {
    await createWorkspace(guard.session, {
      name: String(formData.get("name") ?? ""),
    });
  } catch (error) {
    return { error: mensagem(error) };
  }

  revalidatePath("/", "layout");
  return {};
}

export async function switchWorkspaceAction(formData: FormData) {
  const guard = await guardAction("data:read");
  if (!guard.ok) return;
  await switchWorkspace(guard.session, String(formData.get("workspaceId") ?? ""));
  revalidatePath("/", "layout");
}

export async function removeMemberAction(formData: FormData) {
  const guard = await guardAction("admin:users");
  if (!guard.ok) return;
  await removeMember(guard.session, String(formData.get("membershipId") ?? ""));
  revalidatePath("/definicoes/membros");
}

export async function changeRoleAction(formData: FormData) {
  const guard = await guardAction("admin:users");
  if (!guard.ok) return;
  await changeMemberRole(
    guard.session,
    String(formData.get("membershipId") ?? ""),
    String(formData.get("role") ?? "MEMBER") as Role,
  );
  revalidatePath("/definicoes/membros");
}

export async function cancelInviteAction(formData: FormData) {
  const guard = await guardAction("admin:users");
  if (!guard.ok) return;
  await cancelInvite(guard.session, String(formData.get("inviteId") ?? ""));
  revalidatePath("/definicoes/membros");
}
