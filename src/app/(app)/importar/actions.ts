"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guardAction } from "@/server/auth/guard";
import {
  analisarExtrato,
  confirmarImportacao,
  desfazerImportacao,
  MAX_FILE_BYTES,
  type ConfirmRow,
  type Preview,
} from "@/server/import";

export type ImportState = {
  error?: string;
  preview?: Preview;
  resultado?: { importados: number; batchId: string };
};

function mensagem(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Dados inválidos.";
  }
  return error instanceof Error
    ? error.message
    : "Não foi possível ler o ficheiro.";
}

/**
 * Descodifica os bytes do ficheiro.
 *
 * Metade dos extratos portugueses vem em Windows-1252, não em UTF-8 — é o que
 * o Excel produz em Portugal. Lidos como UTF-8, todos os acentos viram "�" e
 * "Farmácia" fica "Farm�cia" na base de dados para sempre.
 *
 * A deteção é pela negativa: tenta-se UTF-8 e, se aparecer o caráter de
 * substituição, é porque os bytes não eram UTF-8 válido.
 */
function decodificar(bytes: Uint8Array): string {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  if (!utf8.includes("�")) return utf8;
  try {
    return new TextDecoder("windows-1252").decode(bytes);
  } catch {
    return utf8;
  }
}

export async function analisarAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const guard = await guardAction("data:write");
  if (!guard.ok) return { error: guard.error };

  const file = formData.get("ficheiro");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Escolha o ficheiro do extrato." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return {
      error: `O ficheiro tem ${Math.round(file.size / 1024)} kB e o limite é ${
        MAX_FILE_BYTES / 1024
      } kB.`,
    };
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const preview = await analisarExtrato(guard.session, {
      filename: file.name,
      text: decodificar(bytes),
      accountId: String(formData.get("accountId") ?? ""),
    });
    return { preview };
  } catch (error) {
    return { error: mensagem(error) };
  }
}

const confirmRows = z.array(
  z.object({
    date: z.string(),
    description: z.string(),
    amountCents: z.number().int(),
    categoryId: z.string().min(1),
    scope: z.enum(["PERSONAL", "BUSINESS"]),
    hash: z.string().min(1),
    matchedRuleId: z.string().nullable().optional(),
    learn: z.boolean().optional(),
  }),
);

export async function importarAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const guard = await guardAction("data:write");
  if (!guard.ok) return { error: guard.error };

  try {
    const rows = confirmRows.parse(
      JSON.parse(String(formData.get("linhas") ?? "[]")),
    ) as ConfirmRow[];

    const resultado = await confirmarImportacao(guard.session, {
      filename: String(formData.get("filename") ?? "extrato.csv"),
      accountId: String(formData.get("accountId") ?? ""),
      rows,
      totalRows: Number(formData.get("totalRows") ?? rows.length),
    });

    revalidatePath("/", "layout");
    return { resultado };
  } catch (error) {
    return { error: mensagem(error) };
  }
}

export async function desfazerAction(formData: FormData) {
  const guard = await guardAction("data:write");
  if (!guard.ok) return;
  await desfazerImportacao(guard.session, String(formData.get("batchId") ?? ""));
  revalidatePath("/", "layout");
}
