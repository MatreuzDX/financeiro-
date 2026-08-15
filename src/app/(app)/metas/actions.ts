"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guardAction } from "@/server/auth/guard";
import { addContribution, archiveGoal, createGoal } from "@/server/goals";
import { parseAmountToCents } from "@/lib/money";

export type GoalState = { error?: string; success?: string };

function mensagem(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Dados inválidos.";
  }
  return error instanceof Error ? error.message : "Não foi possível guardar.";
}

export async function createGoalAction(
  _prev: GoalState,
  formData: FormData,
): Promise<GoalState> {
  const guard = await guardAction("data:write");
  if (!guard.ok) return { error: guard.error };

  const targetCents = parseAmountToCents(String(formData.get("target") ?? ""));
  if (targetCents === null || targetCents <= 0) {
    return { error: "Escreva quanto quer juntar, por exemplo 1500,00" };
  }

  try {
    await createGoal(guard.session, {
      name: String(formData.get("name") ?? "").trim(),
      targetCents,
      deadline: String(formData.get("deadline") ?? "") || null,
      color: String(formData.get("color") ?? "") || null,
    });
  } catch (error) {
    return { error: mensagem(error) };
  }

  revalidatePath("/", "layout");
  return { success: "Meta criada." };
}

export async function addContributionAction(
  _prev: GoalState,
  formData: FormData,
): Promise<GoalState> {
  const guard = await guardAction("data:write");
  if (!guard.ok) return { error: guard.error };

  const amountCents = parseAmountToCents(String(formData.get("amount") ?? ""));
  if (amountCents === null || amountCents === 0) {
    return { error: "Escreva um valor. Use um valor negativo para tirar." };
  }

  try {
    await addContribution(guard.session, {
      goalId: String(formData.get("goalId") ?? ""),
      date: String(formData.get("date") ?? ""),
      amountCents,
      note: String(formData.get("note") ?? "").trim() || null,
    });
  } catch (error) {
    return { error: mensagem(error) };
  }

  revalidatePath("/", "layout");
  return { success: "Registado." };
}

export async function archiveGoalAction(formData: FormData) {
  const guard = await guardAction("data:write");
  if (!guard.ok) return;
  await archiveGoal(guard.session, String(formData.get("id") ?? ""));
  revalidatePath("/", "layout");
}
