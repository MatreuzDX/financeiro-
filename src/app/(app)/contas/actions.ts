"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guardAction } from "@/server/auth/guard";
import { archiveAccount, createAccount, updateAccount } from "@/server/accounts";
import { parseAmountToCents } from "@/lib/money";

export type SimpleState = { error?: string; success?: string };

function readAccount(formData: FormData) {
  const opening = parseAmountToCents(String(formData.get("openingCents") ?? "0"));
  if (opening === null) throw new Error("O saldo inicial não é um valor válido.");
  return {
    name: String(formData.get("name") ?? "").trim(),
    type: String(formData.get("type") ?? "BANK"),
    institution: String(formData.get("institution") ?? "").trim() || null,
    openingCents: opening,
  };
}

function message(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Dados inválidos.";
  }
  return error instanceof Error ? error.message : "Não foi possível guardar.";
}

export async function createAccountAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const guard = await guardAction("data:write");
  if (!guard.ok) return { error: guard.error };

  try {
    await createAccount(guard.session, readAccount(formData));
  } catch (error) {
    return { error: message(error) };
  }

  revalidatePath("/", "layout");
  return { success: "Conta criada." };
}

export async function updateAccountAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const guard = await guardAction("data:write");
  if (!guard.ok) return { error: guard.error };

  try {
    await updateAccount(guard.session, String(formData.get("id") ?? ""), readAccount(formData));
  } catch (error) {
    return { error: message(error) };
  }

  revalidatePath("/", "layout");
  return { success: "Conta atualizada." };
}

export async function toggleArchiveAccountAction(formData: FormData) {
  const guard = await guardAction("data:write");
  if (!guard.ok) return;
  await archiveAccount(guard.session, String(formData.get("id") ?? ""));
  revalidatePath("/", "layout");
}
