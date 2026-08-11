"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guardAction } from "@/server/auth/guard";
import { createWorkJob, deleteWorkJob } from "@/server/work";
import { parseAmountToCents, parseKmToMetres } from "@/lib/money";

export type WorkState = { error?: string; success?: string };

function centsFrom(formData: FormData, key: string): number {
  const value = parseAmountToCents(String(formData.get(key) ?? "0"));
  return value ?? 0;
}

export async function createWorkJobAction(
  _prev: WorkState,
  formData: FormData,
): Promise<WorkState> {
  const guard = await guardAction("data:write");
  if (!guard.ok) return { error: guard.error };

  const startRaw = String(formData.get("startKm") ?? "").trim();
  const endRaw = String(formData.get("endKm") ?? "").trim();
  const distanceRaw = String(formData.get("distanceKm") ?? "").trim();

  const startMetres = startRaw ? parseKmToMetres(startRaw) : null;
  const endMetres = endRaw ? parseKmToMetres(endRaw) : null;
  const distanceMetres = distanceRaw ? parseKmToMetres(distanceRaw) : 0;

  if ((startRaw && startMetres === null) || (endRaw && endMetres === null)) {
    return { error: "Escreva a quilometragem em números, por exemplo 24150,5" };
  }
  if (distanceRaw && distanceMetres === null) {
    return { error: "A distância não é um número válido." };
  }
  if (startMetres !== null && endMetres !== null && endMetres < startMetres) {
    return {
      error:
        "A quilometragem final não pode ser menor do que a inicial. Confirme os números.",
    };
  }

  const hoursRaw = String(formData.get("hours") ?? "0").replace(",", ".");
  const hoursTenths = Math.round((Number(hoursRaw) || 0) * 10);

  try {
    await createWorkJob(guard.session, {
      clientName: String(formData.get("clientName") ?? "").trim(),
      incomeSourceId: String(formData.get("incomeSourceId") ?? ""),
      vehicleId: String(formData.get("vehicleId") ?? "") || null,
      date: String(formData.get("date") ?? ""),
      payModel: String(formData.get("payModel") ?? "PER_KM"),
      distanceMetres: distanceMetres ?? 0,
      ratePerKmCents: centsFrom(formData, "ratePerKm"),
      deliveries: Number(formData.get("deliveries") ?? 0) || 0,
      ratePerDeliveryCents: centsFrom(formData, "ratePerDelivery"),
      hoursTenths,
      ratePerHourCents: centsFrom(formData, "ratePerHour"),
      fixedCents: centsFrom(formData, "fixed"),
      tipsCents: centsFrom(formData, "tips"),
      startMetres,
      endMetres,
      accountId: String(formData.get("accountId") ?? ""),
      categoryId: String(formData.get("categoryId") ?? ""),
      notes: String(formData.get("notes") ?? "").trim() || null,
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
  return { success: "Trabalho registado e receita lançada." };
}

export async function deleteWorkJobAction(formData: FormData) {
  const guard = await guardAction("data:delete");
  if (!guard.ok) return;
  await deleteWorkJob(guard.session, String(formData.get("id") ?? ""));
  revalidatePath("/", "layout");
}
