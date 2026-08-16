"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guardAction } from "@/server/auth/guard";
import { guardarPerfilFiscal } from "@/server/fiscal";

export type FiscalState = { error?: string; guardado?: boolean };

function numero(formData: FormData, campo: string, omissao: number): number {
  const bruto = String(formData.get(campo) ?? "").replace(",", ".").trim();
  const valor = Number(bruto);
  return Number.isFinite(valor) ? valor : omissao;
}

export async function guardarPerfilAction(
  _prev: FiscalState,
  formData: FormData,
): Promise<FiscalState> {
  const guard = await guardAction("data:write");
  if (!guard.ok) return { error: guard.error };

  try {
    await guardarPerfilFiscal(guard.session, {
      independente: formData.get("independente") === "on",
      regimeIva: String(formData.get("regimeIva") ?? "ISENTO_ART53"),
      retencaoNaFonte: formData.get("retencaoNaFonte") === "on",
      inicioAtividade: String(formData.get("inicioAtividade") ?? "") || null,
      taxaSsPercent: numero(formData, "taxaSsPercent", 21.4),
      coeficienteSsPercent: numero(formData, "coeficienteSsPercent", 70),
      taxaIvaPercent: numero(formData, "taxaIvaPercent", 23),
      taxaRetencaoPercent: numero(formData, "taxaRetencaoPercent", 23),
      reservaIrsPercent: numero(formData, "reservaIrsPercent", 20),
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
  return { guardado: true };
}
