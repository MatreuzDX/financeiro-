"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guardAction } from "@/server/auth/guard";
import { createIncomeSource } from "@/server/income-sources";

export type SimpleState = { error?: string; success?: string };

export async function createIncomeSourceAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const guard = await guardAction("data:write");
  if (!guard.ok) return { error: guard.error };

  try {
    await createIncomeSource(guard.session, {
      name: String(formData.get("name") ?? "").trim(),
      type: String(formData.get("type") ?? "OTHER"),
      scope: String(formData.get("scope") ?? "BUSINESS"),
      color: String(formData.get("color") ?? "") || null,
      active: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.issues[0]?.message ?? "Dados inválidos." };
    }
    return {
      error: error instanceof Error ? error.message : "Não foi possível guardar.",
    };
  }

  revalidatePath("/", "layout");
  return { success: "Fonte de rendimento criada." };
}
