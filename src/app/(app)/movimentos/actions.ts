"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { guardAction } from "@/server/auth/guard";
import {
  createTransaction,
  deleteTransaction,
  restoreTransaction,
  updateTransaction,
} from "@/server/ledger";
import { parseAmountToCents } from "@/lib/money";

export type TxFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

function collect(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && key !== "password") out[key] = value;
  }
  return out;
}

/** Traduz os erros do Zod em erros por campo, para o formulário os mostrar. */
function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

function buildInput(formData: FormData) {
  const type = String(formData.get("type") ?? "EXPENSE");
  const amountCents = parseAmountToCents(String(formData.get("amount") ?? ""));

  const base = {
    date: String(formData.get("date") ?? ""),
    description: String(formData.get("description") ?? "").trim(),
    amountCents: amountCents ?? 0,
    notes: String(formData.get("notes") ?? "").trim() || null,
    scope: String(formData.get("scope") ?? "PERSONAL"),
  };

  if (type === "TRANSFER") {
    return {
      ...base,
      type: "TRANSFER" as const,
      fromAccountId: String(formData.get("fromAccountId") ?? ""),
      toAccountId: String(formData.get("toAccountId") ?? ""),
    };
  }

  const common = {
    ...base,
    accountId: String(formData.get("accountId") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    vehicleId: String(formData.get("vehicleId") ?? "") || null,
  };

  if (type === "INCOME") {
    return {
      ...common,
      type: "INCOME" as const,
      incomeSourceId: String(formData.get("incomeSourceId") ?? "") || null,
    };
  }

  return { ...common, type: "EXPENSE" as const };
}

export async function createTransactionAction(
  _prev: TxFormState,
  formData: FormData,
): Promise<TxFormState> {
  const guard = await guardAction("data:write");
  if (!guard.ok) return { error: guard.error, values: collect(formData) };

  const amountRaw = String(formData.get("amount") ?? "");
  if (parseAmountToCents(amountRaw) === null) {
    return {
      fieldErrors: { amount: "Escreva um valor válido, por exemplo 12,40" },
      values: collect(formData),
    };
  }

  try {
    await createTransaction(guard.session, buildInput(formData));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { fieldErrors: zodFieldErrors(error), values: collect(formData) };
    }
    return {
      error: error instanceof Error ? error.message : "Não foi possível guardar.",
      values: collect(formData),
    };
  }

  revalidatePath("/", "layout");
  redirect("/movimentos?guardado=1");
}

export async function updateTransactionAction(
  id: string,
  _prev: TxFormState,
  formData: FormData,
): Promise<TxFormState> {
  const guard = await guardAction("data:write");
  if (!guard.ok) return { error: guard.error, values: collect(formData) };

  if (parseAmountToCents(String(formData.get("amount") ?? "")) === null) {
    return {
      fieldErrors: { amount: "Escreva um valor válido, por exemplo 12,40" },
      values: collect(formData),
    };
  }

  try {
    await updateTransaction(guard.session, id, buildInput(formData));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { fieldErrors: zodFieldErrors(error), values: collect(formData) };
    }
    return {
      error: error instanceof Error ? error.message : "Não foi possível guardar.",
      values: collect(formData),
    };
  }

  revalidatePath("/", "layout");
  redirect("/movimentos?guardado=1");
}

export async function deleteTransactionAction(formData: FormData) {
  const guard = await guardAction("data:delete");
  if (!guard.ok) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await deleteTransaction(guard.session, id);
  revalidatePath("/", "layout");
  // Leva o id no endereço para a lista poder oferecer "anular". Apagar é
  // sempre soft, por isso desfazer é só limpar o `deletedAt`.
  redirect(`/movimentos?apagado=${id}`);
}

export async function restoreTransactionAction(formData: FormData) {
  const guard = await guardAction("data:write");
  if (!guard.ok) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await restoreTransaction(guard.session, id);
  revalidatePath("/", "layout");
  redirect("/movimentos?restaurado=1");
}
