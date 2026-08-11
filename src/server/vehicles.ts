import "server-only";
import { z } from "zod";
import { prisma } from "@/server/db";
import { recordAudit } from "@/server/audit";
import { fuelTotalCents } from "@/lib/money";
import { fromIso, isValidIsoDate } from "@/lib/date";
import type { SessionUser } from "@/server/auth/session";

export const VEHICLE_TYPE_LABELS = {
  MOTORCYCLE: "Mota",
  SCOOTER: "Scooter",
  CAR: "Carro",
  VAN: "Carrinha",
  BICYCLE: "Bicicleta",
  OTHER: "Outro",
} as const;

export const FUEL_TYPE_LABELS = {
  PETROL: "Gasolina",
  DIESEL: "Gasóleo",
  ELECTRIC: "Elétrico",
  HYBRID: "Híbrido",
  LPG: "GPL",
  NONE: "Não aplicável",
} as const;

const isoDate = z.string().refine(isValidIsoDate, "Data inválida");

export const vehicleInput = z.object({
  name: z.string().trim().min(1, "Dê um nome ao veículo").max(60),
  brand: z.string().trim().max(40).optional().nullable(),
  model: z.string().trim().max(40).optional().nullable(),
  year: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 1)
    .optional()
    .nullable(),
  plate: z.string().trim().max(15).optional().nullable(),
  type: z.enum(["MOTORCYCLE", "SCOOTER", "CAR", "VAN", "BICYCLE", "OTHER"]),
  fuelType: z.enum(["PETROL", "DIESEL", "ELECTRIC", "HYBRID", "LPG", "NONE"]),
  currentMetres: z.number().int().min(0).max(2_147_483_647),
  active: z.boolean().default(true),
});

export const mileageInput = z
  .object({
    vehicleId: z.string().min(1, "Escolha o veículo"),
    date: isoDate,
    startMetres: z.number().int().min(0).max(2_147_483_647),
    endMetres: z.number().int().min(0).max(2_147_483_647),
    purpose: z.enum(["WORK", "PERSONAL"]).default("WORK"),
    notes: z.string().trim().max(500).optional().nullable(),
  })
  .refine((v) => v.endMetres >= v.startMetres, {
    message: "A quilometragem final não pode ser menor do que a inicial",
    path: ["endMetres"],
  });

export const fuelInput = z.object({
  vehicleId: z.string().min(1, "Escolha o veículo"),
  date: isoDate,
  odometerMetres: z.number().int().min(0).max(2_147_483_647),
  litersMl: z.number().int().positive("Indique quantos litros abasteceu"),
  pricePerLiterE4: z.number().int().min(0).max(2_147_483_647),
  fullTank: z.boolean().default(true),
  /** Onde saiu o dinheiro. Se vier, cria também a despesa. */
  accountId: z.string().min(1).optional().nullable(),
  categoryId: z.string().min(1).optional().nullable(),
});

export async function listVehicles(workspaceId: string, onlyActive = false) {
  return prisma.vehicle.findMany({
    where: { workspaceId, ...(onlyActive ? { active: true } : {}) },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
}

export async function getVehicle(workspaceId: string, id: string) {
  return prisma.vehicle.findFirst({ where: { id, workspaceId } });
}

export async function createVehicle(session: SessionUser, raw: unknown) {
  const input = vehicleInput.parse(raw);

  const duplicate = await prisma.vehicle.findFirst({
    where: { workspaceId: session.workspaceId, name: input.name },
    select: { id: true },
  });
  if (duplicate) throw new Error("Já existe um veículo com esse nome.");

  const vehicle = await prisma.vehicle.create({
    data: { workspaceId: session.workspaceId, ...input },
  });

  await recordAudit({
    action: "vehicle.created",
    workspaceId: session.workspaceId,
    userId: session.userId,
    userEmail: session.email,
    entity: "Vehicle",
    entityId: vehicle.id,
    metadata: { name: vehicle.name, type: vehicle.type },
  });

  return vehicle;
}

export async function updateVehicle(
  session: SessionUser,
  id: string,
  raw: unknown,
) {
  const input = vehicleInput.parse(raw);
  const existing = await prisma.vehicle.findFirst({
    where: { id, workspaceId: session.workspaceId },
  });
  if (!existing) throw new Error("Veículo não encontrado.");

  await prisma.vehicle.update({ where: { id }, data: input });

  await recordAudit({
    action: "vehicle.updated",
    workspaceId: session.workspaceId,
    userId: session.userId,
    userEmail: session.email,
    entity: "Vehicle",
    entityId: id,
    metadata: { antes: existing.name, depois: input.name },
  });
}

/**
 * Regista quilómetros percorridos.
 *
 * `totalMetres` é calculado aqui e verificado por CHECK na base — nunca vem
 * do formulário. Se viesse, bastava adulterar o campo escondido para inflar
 * a quilometragem de trabalho e, com ela, a receita ao quilómetro.
 */
export async function createMileage(
  session: SessionUser,
  raw: unknown,
  options: { workJobId?: string } = {},
) {
  const input = mileageInput.parse(raw);

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: input.vehicleId, workspaceId: session.workspaceId },
    select: { id: true, currentMetres: true },
  });
  if (!vehicle) throw new Error("Veículo inválido.");

  const totalMetres = input.endMetres - input.startMetres;

  const log = await prisma.$transaction(async (tx) => {
    const created = await tx.mileageLog.create({
      data: {
        workspaceId: session.workspaceId,
        vehicleId: input.vehicleId,
        workJobId: options.workJobId ?? null,
        date: fromIso(input.date),
        startMetres: input.startMetres,
        endMetres: input.endMetres,
        totalMetres,
        purpose: input.purpose,
        notes: input.notes || null,
      },
    });

    // O conta-quilómetros só anda para a frente.
    if (input.endMetres > vehicle.currentMetres) {
      await tx.vehicle.update({
        where: { id: vehicle.id },
        data: { currentMetres: input.endMetres },
      });
    }

    await recordAudit(
      {
        action: "mileage.created",
        workspaceId: session.workspaceId,
        userId: session.userId,
        userEmail: session.email,
        entity: "MileageLog",
        entityId: created.id,
        metadata: { totalMetres, date: input.date },
      },
      tx,
    );

    return created;
  });

  return log;
}

/**
 * Regista um abastecimento e, se lhe indicarem conta e categoria, cria
 * também a despesa correspondente — para o custo entrar no balanço em vez
 * de ficar só num registo técnico.
 */
export async function createFuelLog(session: SessionUser, raw: unknown) {
  const input = fuelInput.parse(raw);

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: input.vehicleId, workspaceId: session.workspaceId },
    select: { id: true, name: true, currentMetres: true },
  });
  if (!vehicle) throw new Error("Veículo inválido.");

  const totalCents = fuelTotalCents(input.litersMl, input.pricePerLiterE4);

  return prisma.$transaction(async (tx) => {
    const log = await tx.fuelLog.create({
      data: {
        workspaceId: session.workspaceId,
        vehicleId: input.vehicleId,
        date: fromIso(input.date),
        odometerMetres: input.odometerMetres,
        litersMl: input.litersMl,
        pricePerLiterE4: input.pricePerLiterE4,
        totalCents,
        fullTank: input.fullTank,
      },
    });

    if (input.odometerMetres > vehicle.currentMetres) {
      await tx.vehicle.update({
        where: { id: vehicle.id },
        data: { currentMetres: input.odometerMetres },
      });
    }

    if (input.accountId && input.categoryId && totalCents > 0) {
      const [account, category] = await Promise.all([
        tx.account.count({
          where: { id: input.accountId, workspaceId: session.workspaceId },
        }),
        tx.category.findFirst({
          where: { id: input.categoryId, workspaceId: session.workspaceId },
          select: { type: true },
        }),
      ]);
      if (account === 0) throw new Error("Conta inválida.");
      if (!category || category.type !== "EXPENSE") {
        throw new Error("A categoria do abastecimento tem de ser de despesa.");
      }

      await tx.transaction.create({
        data: {
          workspaceId: session.workspaceId,
          date: fromIso(input.date),
          type: "EXPENSE",
          scope: "BUSINESS",
          description: `Combustível — ${vehicle.name}`,
          vehicleId: vehicle.id,
          createdById: session.userId,
          entries: {
            create: [
              {
                workspaceId: session.workspaceId,
                accountId: input.accountId,
                amountCents: -totalCents,
              },
              {
                workspaceId: session.workspaceId,
                categoryId: input.categoryId,
                amountCents: totalCents,
              },
            ],
          },
        },
      });

      const balance = await tx.entry.aggregate({
        _sum: { amountCents: true },
        where: {
          accountId: input.accountId,
          transaction: { deletedAt: null, status: "CLEARED" },
        },
      });
      const acc = await tx.account.findUnique({
        where: { id: input.accountId },
        select: { openingCents: true },
      });
      await tx.account.update({
        where: { id: input.accountId },
        data: {
          cachedBalanceCents:
            (acc?.openingCents ?? 0) + (balance._sum.amountCents ?? 0),
        },
      });
    }

    await recordAudit(
      {
        action: "fuel.created",
        workspaceId: session.workspaceId,
        userId: session.userId,
        userEmail: session.email,
        entity: "FuelLog",
        entityId: log.id,
        metadata: { litersMl: input.litersMl, totalCents, date: input.date },
      },
      tx,
    );

    return log;
  });
}

export async function listMileage(
  workspaceId: string,
  vehicleId: string,
  take = 30,
) {
  return prisma.mileageLog.findMany({
    where: { workspaceId, vehicleId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take,
  });
}

export async function listFuelLogs(
  workspaceId: string,
  vehicleId: string,
  take = 30,
) {
  return prisma.fuelLog.findMany({
    where: { workspaceId, vehicleId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take,
  });
}
