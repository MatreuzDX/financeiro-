"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guardAction } from "@/server/auth/guard";
import { createRule, deleteRule } from "@/server/rules";

export type RegrasState = { error?: string; criada?: string };

export async function createRuleAction(
  _prev: RegrasState,
  formData: FormData,
): Promise<RegrasState> {
  const guard = await guardAction("data:write");
  if (!guard.ok) return { error: guard.error };

  try {
    const regra = await createRule(guard.session, {
      label: String(formData.get("label") ?? ""),
      categoryId: String(formData.get("categoryId") ?? ""),
      scope: String(formData.get("scope") ?? "PERSONAL"),
    });
    revalidatePath("/definicoes/regras");
    return { criada: regra.label };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.issues[0]?.message ?? "Dados inválidos." };
    }
    return {
      error: error instanceof Error ? error.message : "Não foi possível guardar.",
    };
  }
}

export async function deleteRuleAction(formData: FormData) {
  const guard = await guardAction("data:write");
  if (!guard.ok) return;
  await deleteRule(guard.session, String(formData.get("id") ?? ""));
  revalidatePath("/definicoes/regras");
}
