"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guardAction } from "@/server/auth/guard";
import { conferir, type Resultado } from "@/server/reconciliacao";
import { parseAmountToCents } from "@/lib/money";

export type ConferirState = { error?: string; resultado?: Resultado };

export async function conferirAction(
  _prev: ConferirState,
  formData: FormData,
): Promise<ConferirState> {
  const guard = await guardAction("data:write");
  if (!guard.ok) return { error: guard.error };

  const bankCents = parseAmountToCents(String(formData.get("saldo") ?? ""));
  if (bankCents === null) {
    return { error: "Escreva o saldo do banco, por exemplo 1.234,56" };
  }

  try {
    const resultado = await conferir(guard.session, {
      accountId: String(formData.get("accountId") ?? ""),
      date: String(formData.get("date") ?? ""),
      bankCents,
      notes: String(formData.get("notes") ?? "") || null,
    });
    revalidatePath("/conferir");
    return { resultado };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.issues[0]?.message ?? "Dados inválidos." };
    }
    return {
      error: error instanceof Error ? error.message : "Não foi possível conferir.",
    };
  }
}
