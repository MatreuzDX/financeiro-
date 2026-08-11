"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guardAction } from "@/server/auth/guard";
import { saveBudget } from "@/server/budget";
import { parseAmountToCents } from "@/lib/money";

export type BudgetState = { error?: string; success?: string };

export async function saveBudgetAction(
  _prev: BudgetState,
  formData: FormData,
): Promise<BudgetState> {
  const guard = await guardAction("data:write");
  if (!guard.ok) return { error: guard.error };

  const month = String(formData.get("month") ?? "");
  const lines: { categoryId: string; plannedCents: number }[] = [];

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("cat:")) continue;
    const categoryId = key.slice(4);
    const raw = String(value).trim();
    if (raw === "") continue;
    const cents = parseAmountToCents(raw);
    if (cents === null) {
      return { error: "Há um valor inválido no orçamento. Use, por exemplo, 250,00" };
    }
    if (cents < 0) return { error: "O orçamento não pode ser negativo." };
    lines.push({ categoryId, plannedCents: cents });
  }

  try {
    await saveBudget(guard.session, { month, lines });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.issues[0]?.message ?? "Dados inválidos." };
    }
    return {
      error: error instanceof Error ? error.message : "Não foi possível guardar.",
    };
  }

  revalidatePath("/", "layout");
  return { success: "Orçamento guardado." };
}
