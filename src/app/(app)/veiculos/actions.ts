"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guardAction } from "@/server/auth/guard";
import { createFuelLog, createMileage, createVehicle } from "@/server/vehicles";
import { parseKmToMetres } from "@/lib/money";

export type SimpleState = { error?: string; success?: string };

function message(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Dados inválidos.";
  }
  return error instanceof Error ? error.message : "Não foi possível guardar.";
}

export async function createVehicleAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const guard = await guardAction("data:write");
  if (!guard.ok) return { error: guard.error };

  const km = parseKmToMetres(String(formData.get("currentKm") ?? "0"));
  if (km === null) return { error: "A quilometragem atual não é um valor válido." };

  const yearRaw = String(formData.get("year") ?? "").trim();

  try {
    await createVehicle(guard.session, {
      name: String(formData.get("name") ?? "").trim(),
      brand: String(formData.get("brand") ?? "").trim() || null,
      model: String(formData.get("model") ?? "").trim() || null,
      year: yearRaw ? Number(yearRaw) : null,
      plate: String(formData.get("plate") ?? "").trim() || null,
      type: String(formData.get("type") ?? "MOTORCYCLE"),
      fuelType: String(formData.get("fuelType") ?? "PETROL"),
      currentMetres: km,
      active: true,
    });
  } catch (error) {
    return { error: message(error) };
  }

  revalidatePath("/", "layout");
  return { success: "Veículo criado." };
}

export async function createMileageAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const guard = await guardAction("data:write");
  if (!guard.ok) return { error: guard.error };

  const start = parseKmToMetres(String(formData.get("startKm") ?? ""));
  const end = parseKmToMetres(String(formData.get("endKm") ?? ""));
  if (start === null || end === null) {
    return { error: "Escreva a quilometragem em números, por exemplo 24150,5" };
  }
  if (end < start) {
    return {
      error:
        "A quilometragem final não pode ser menor do que a inicial. Confirme os números.",
    };
  }

  try {
    await createMileage(guard.session, {
      vehicleId: String(formData.get("vehicleId") ?? ""),
      date: String(formData.get("date") ?? ""),
      startMetres: start,
      endMetres: end,
      purpose: String(formData.get("purpose") ?? "WORK"),
      notes: String(formData.get("notes") ?? "").trim() || null,
    });
  } catch (error) {
    return { error: message(error) };
  }

  revalidatePath("/", "layout");
  const km = (end - start) / 1000;
  return {
    success: `Registados ${km.toLocaleString("pt-PT", { maximumFractionDigits: 1 })} km.`,
  };
}

export async function createFuelAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const guard = await guardAction("data:write");
  if (!guard.ok) return { error: guard.error };

  const odometer = parseKmToMetres(String(formData.get("odometerKm") ?? ""));
  const litersRaw = String(formData.get("liters") ?? "").replace(",", ".");
  const priceRaw = String(formData.get("pricePerLiter") ?? "").replace(",", ".");

  if (odometer === null) return { error: "Quilometragem inválida." };
  if (!/^\d+(\.\d{1,3})?$/.test(litersRaw) || Number(litersRaw) <= 0) {
    return { error: "Indique quantos litros abasteceu, por exemplo 6,5" };
  }
  if (!/^\d+(\.\d{1,4})?$/.test(priceRaw)) {
    return { error: "Indique o preço por litro, por exemplo 1,689" };
  }

  try {
    await createFuelLog(guard.session, {
      vehicleId: String(formData.get("vehicleId") ?? ""),
      date: String(formData.get("date") ?? ""),
      odometerMetres: odometer,
      litersMl: Math.round(Number(litersRaw) * 1000),
      pricePerLiterE4: Math.round(Number(priceRaw) * 10_000),
      fullTank: formData.get("fullTank") === "on",
      accountId: String(formData.get("accountId") ?? "") || null,
      categoryId: String(formData.get("categoryId") ?? "") || null,
    });
  } catch (error) {
    return { error: message(error) };
  }

  revalidatePath("/", "layout");
  return { success: "Abastecimento registado." };
}
