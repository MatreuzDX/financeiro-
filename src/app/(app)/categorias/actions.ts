"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guardAction } from "@/server/auth/guard";
import {
  archiveCategory,
  createCategory,
} from "@/server/categories";

export type SimpleState = { error?: string; success?: string };

export async function createCategoryAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const guard = await guardAction("data:write");
  if (!guard.ok) return { error: guard.error };

  try {
    await createCategory(guard.session, {
      name: String(formData.get("name") ?? "").trim(),
      type: String(formData.get("type") ?? "EXPENSE"),
      scope: String(formData.get("scope") ?? "PERSONAL"),
      color: String(formData.get("color") ?? "") || null,
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
  return { success: "Categoria criada." };
}

export async function toggleArchiveCategoryAction(formData: FormData) {
  const guard = await guardAction("data:write");
  if (!guard.ok) return;
  await archiveCategory(guard.session, String(formData.get("id") ?? ""));
  revalidatePath("/", "layout");
}
