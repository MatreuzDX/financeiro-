"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guardAction } from "@/server/auth/guard";
import {
  confirmarPagamento,
  createRecurring,
  deleteRecurring,
  dispensarVencimento,
  toggleRecurring,
} from "@/server/recurring";
import { parseAmountToCents } from "@/lib/money";
import type { IsoDate } from "@/lib/date";

export type RecurringState = { error?: string; success?: string };

function mensagem(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Dados inválidos.";
  }
  return error instanceof Error ? error.message : "Não foi possível guardar.";
}

function numeroOuNulo(valor: FormDataEntryValue | null): number | null {
  const t = String(valor ?? "").trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export async function createRecurringAction(
  _prev: RecurringState,
  formData: FormData,
): Promise<RecurringState> {
  const guard = await guardAction("data:write");
  if (!guard.ok) return { error: guard.error };

  const amountCents = parseAmountToCents(String(formData.get("amount") ?? ""));
  if (amountCents === null) {
    return { error: "Escreva um valor válido, por exemplo 500,00" };
  }

  try {
    await createRecurring(guard.session, {
      name: String(formData.get("name") ?? "").trim(),
      type: String(formData.get("type") ?? "EXPENSE"),
      amountCents,
      scope: String(formData.get("scope") ?? "PERSONAL"),
      accountId: String(formData.get("accountId") ?? ""),
      categoryId: String(formData.get("categoryId") ?? ""),
      frequency: String(formData.get("frequency") ?? "MONTHLY"),
      dayOfMonth: numeroOuNulo(formData.get("dayOfMonth")),
      weekday: numeroOuNulo(formData.get("weekday")),
      monthOfYear: numeroOuNulo(formData.get("monthOfYear")),
      startDate: String(formData.get("startDate") ?? ""),
      endDate: String(formData.get("endDate") ?? "") || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    });
  } catch (error) {
    return { error: mensagem(error) };
  }

  revalidatePath("/", "layout");
  return { success: "Recorrência criada. As próximas ocorrências já aparecem em contas a pagar." };
}

export async function toggleRecurringAction(formData: FormData) {
  const guard = await guardAction("data:write");
  if (!guard.ok) return;
  await toggleRecurring(guard.session, String(formData.get("id") ?? ""));
  revalidatePath("/", "layout");
}

export async function deleteRecurringAction(formData: FormData) {
  const guard = await guardAction("data:delete");
  if (!guard.ok) return;
  await deleteRecurring(guard.session, String(formData.get("id") ?? ""));
  revalidatePath("/", "layout");
}

export async function confirmarPagamentoAction(formData: FormData) {
  const guard = await guardAction("data:write");
  if (!guard.ok) return;
  const data = String(formData.get("data") ?? "").trim();
  await confirmarPagamento(
    guard.session,
    String(formData.get("id") ?? ""),
    data ? (data as IsoDate) : undefined,
  );
  revalidatePath("/", "layout");
}

export async function dispensarVencimentoAction(formData: FormData) {
  const guard = await guardAction("data:delete");
  if (!guard.ok) return;
  await dispensarVencimento(guard.session, String(formData.get("id") ?? ""));
  revalidatePath("/", "layout");
}
