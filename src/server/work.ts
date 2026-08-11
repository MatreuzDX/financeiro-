/**
 * Trabalhos e entregas.
 *
 * O módulo que justifica o produto: transforma "trabalhei para a Pizzaria X,
 * 150 km a €0,40/km" em receita real no balanço, e mostra o custo do veículo
 * ao lado — para que €60 recebidos nunca sejam confundidos com €60 ganhos.
 */

import "server-only";
import { z } from "zod";
import { prisma } from "@/server/db";
import { recordAudit } from "@/server/audit";
import { divRound, kmPayToCents } from "@/lib/money";
import { fromIso, isValidIsoDate, toIso } from "@/lib/date";
import { recomputeAccountBalance } from "@/server/ledger";
import type { SessionUser } from "@/server/auth/session";

export const PAY_MODEL_LABELS = {
  PER_KM: "Por quilómetro",
  PER_DELIVERY: "Por entrega",
  HOURLY: "Por hora",
  FIXED: "Valor fixo",
} as const;

const isoDate = z.string().refine(isValidIsoDate, "Data inválida");

export const workJobInput = z
  .object({
    clientName: z.string().trim().min(1, "Para quem trabalhou?").max(80),
    incomeSourceId: z.string().min(1, "Escolha a fonte de rendimento"),
    vehicleId: z.string().min(1).optional().nullable(),
    date: isoDate,
    payModel: z.enum(["PER_KM", "PER_DELIVERY", "HOURLY", "FIXED"]),

    distanceMetres: z.number().int().min(0).max(2_147_483_647).default(0),
    ratePerKmCents: z.number().int().min(0).max(100_000).default(0),
    deliveries: z.number().int().min(0).max(10_000).default(0),
    ratePerDeliveryCents: z.number().int().min(0).max(1_000_000).default(0),
    hoursTenths: z.number().int().min(0).max(10_000).default(0),
    ratePerHourCents: z.number().int().min(0).max(1_000_000).default(0),
    fixedCents: z.number().int().min(0).max(2_147_483_647).default(0),
    tipsCents: z.number().int().min(0).max(2_147_483_647).default(0),

    /** Quilometragem do conta-quilómetros; opcional, mas é o que dá o custo real. */
    startMetres: z.number().int().min(0).max(2_147_483_647).optional().nullable(),
    endMetres: z.number().int().min(0).max(2_147_483_647).optional().nullable(),

    /** Onde entra o dinheiro. */
    accountId: z.string().min(1, "Escolha onde entrou o dinheiro"),
    categoryId: z.string().min(1, "Escolha a categoria de receita"),

    notes: z.string().trim().max(1000).optional().nullable(),
  })
  .refine(
    (v) =>
      v.startMetres == null ||
      v.endMetres == null ||
      v.endMetres >= v.startMetres,
    {
      message: "A quilometragem final não pode ser menor do que a inicial",
      path: ["endMetres"],
    },
  )
  .refine((v) => v.payModel !== "PER_KM" || v.ratePerKmCents > 0, {
    message: "Indique quanto lhe pagam por quilómetro",
    path: ["ratePerKmCents"],
  })
  .refine((v) => v.payModel !== "PER_DELIVERY" || v.ratePerDeliveryCents > 0, {
    message: "Indique quanto lhe pagam por entrega",
    path: ["ratePerDeliveryCents"],
  })
  .refine((v) => v.payModel !== "HOURLY" || v.ratePerHourCents > 0, {
    message: "Indique quanto lhe pagam por hora",
    path: ["ratePerHourCents"],
  })
  .refine((v) => v.payModel !== "FIXED" || v.fixedCents > 0, {
    message: "Indique o valor acordado",
    path: ["fixedCents"],
  });

export type WorkJobInput = z.infer<typeof workJobInput>;

/**
 * Quanto o trabalho rendeu, em cêntimos.
 *
 * Calculado SEMPRE no servidor. Se viesse do formulário, qualquer pessoa
 * podia escrever o valor que quisesse e a contabilidade passava a ser
 * ficção.
 *
 *   150 km × €0,40/km → kmPayToCents(150000, 40) = 6000 = €60,00 exatos
 */
export function computeGrossCents(input: {
  payModel: WorkJobInput["payModel"];
  distanceMetres: number;
  ratePerKmCents: number;
  deliveries: number;
  ratePerDeliveryCents: number;
  hoursTenths: number;
  ratePerHourCents: number;
  fixedCents: number;
  tipsCents: number;
}): number {
  let base = 0;
  switch (input.payModel) {
    case "PER_KM":
      base = kmPayToCents(input.distanceMetres, input.ratePerKmCents);
      break;
    case "PER_DELIVERY":
      base = input.deliveries * input.ratePerDeliveryCents;
      break;
    case "HOURLY":
      base = divRound(input.hoursTenths * input.ratePerHourCents, 10);
      break;
    case "FIXED":
      base = input.fixedCents;
      break;
  }
  return base + input.tipsCents;
}

export async function createWorkJob(session: SessionUser, raw: unknown) {
  const parsed = workJobInput.parse(raw);

  // Se deram início e fim do conta-quilómetros, é essa a distância — não a
  // que possa ter vindo escrita à parte.
  const distanceMetres =
    parsed.startMetres != null && parsed.endMetres != null
      ? parsed.endMetres - parsed.startMetres
      : parsed.distanceMetres;

  const input = { ...parsed, distanceMetres };
  const grossCents = computeGrossCents(input);

  if (grossCents <= 0) {
    throw new Error("O trabalho tem de render mais do que zero.");
  }

  return prisma.$transaction(async (tx) => {
    const [source, category, account, vehicle] = await Promise.all([
      tx.incomeSource.count({
        where: { id: input.incomeSourceId, workspaceId: session.workspaceId },
      }),
      tx.category.findFirst({
        where: { id: input.categoryId, workspaceId: session.workspaceId },
        select: { type: true },
      }),
      tx.account.count({
        where: {
          id: input.accountId,
          workspaceId: session.workspaceId,
          archived: false,
        },
      }),
      input.vehicleId
        ? tx.vehicle.findFirst({
            where: { id: input.vehicleId, workspaceId: session.workspaceId },
            select: { id: true, currentMetres: true },
          })
        : Promise.resolve(null),
    ]);

    if (source === 0) throw new Error("Fonte de rendimento inválida.");
    if (account === 0) throw new Error("Conta inválida.");
    if (!category || category.type !== "INCOME") {
      throw new Error("A categoria tem de ser de receita.");
    }
    if (input.vehicleId && !vehicle) throw new Error("Veículo inválido.");

    const job = await tx.workJob.create({
      data: {
        workspaceId: session.workspaceId,
        incomeSourceId: input.incomeSourceId,
        vehicleId: input.vehicleId || null,
        clientName: input.clientName,
        date: fromIso(input.date),
        payModel: input.payModel,
        distanceMetres,
        ratePerKmCents: input.ratePerKmCents,
        deliveries: input.deliveries,
        ratePerDeliveryCents: input.ratePerDeliveryCents,
        hoursTenths: input.hoursTenths,
        ratePerHourCents: input.ratePerHourCents,
        fixedCents: input.fixedCents,
        tipsCents: input.tipsCents,
        grossCents,
        notes: input.notes || null,
      },
    });

    // A receita entra no balanço como qualquer outra: duas linhas que somam
    // zero, ligadas ao trabalho e ao veículo.
    await tx.transaction.create({
      data: {
        workspaceId: session.workspaceId,
        date: fromIso(input.date),
        type: "INCOME",
        scope: "BUSINESS",
        description: input.clientName,
        notes: input.notes || null,
        incomeSourceId: input.incomeSourceId,
        vehicleId: input.vehicleId || null,
        workJobId: job.id,
        createdById: session.userId,
        entries: {
          create: [
            {
              workspaceId: session.workspaceId,
              accountId: input.accountId,
              amountCents: grossCents,
            },
            {
              workspaceId: session.workspaceId,
              categoryId: input.categoryId,
              amountCents: -grossCents,
            },
          ],
        },
      },
    });

    await recomputeAccountBalance(tx, input.accountId);

    if (vehicle && input.startMetres != null && input.endMetres != null) {
      await tx.mileageLog.create({
        data: {
          workspaceId: session.workspaceId,
          vehicleId: vehicle.id,
          workJobId: job.id,
          date: fromIso(input.date),
          startMetres: input.startMetres,
          endMetres: input.endMetres,
          totalMetres: input.endMetres - input.startMetres,
          purpose: "WORK",
        },
      });
      if (input.endMetres > vehicle.currentMetres) {
        await tx.vehicle.update({
          where: { id: vehicle.id },
          data: { currentMetres: input.endMetres },
        });
      }
    }

    await recordAudit(
      {
        action: "workjob.created",
        workspaceId: session.workspaceId,
        userId: session.userId,
        userEmail: session.email,
        entity: "WorkJob",
        entityId: job.id,
        metadata: {
          clientName: input.clientName,
          grossCents,
          distanceMetres,
          date: input.date,
        },
      },
      tx,
    );

    return job;
  });
}

export type WorkJobRow = {
  id: string;
  date: string;
  clientName: string;
  incomeSourceName: string;
  vehicleName: string | null;
  payModel: WorkJobInput["payModel"];
  distanceMetres: number;
  ratePerKmCents: number;
  deliveries: number;
  grossCents: number;
  tipsCents: number;
};

export async function listWorkJobs(
  workspaceId: string,
  range?: { from: string; to: string },
  take = 50,
): Promise<WorkJobRow[]> {
  const jobs = await prisma.workJob.findMany({
    where: {
      workspaceId,
      ...(range
        ? { date: { gte: fromIso(range.from), lte: fromIso(range.to) } }
        : {}),
    },
    include: {
      incomeSource: { select: { name: true } },
      vehicle: { select: { name: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take,
  });

  return jobs.map((j) => ({
    id: j.id,
    date: toIso(j.date),
    clientName: j.clientName,
    incomeSourceName: j.incomeSource.name,
    vehicleName: j.vehicle?.name ?? null,
    payModel: j.payModel,
    distanceMetres: j.distanceMetres,
    ratePerKmCents: j.ratePerKmCents,
    deliveries: j.deliveries,
    grossCents: j.grossCents,
    tipsCents: j.tipsCents,
  }));
}

export async function deleteWorkJob(session: SessionUser, id: string) {
  await prisma.$transaction(async (tx) => {
    const job = await tx.workJob.findFirst({
      where: { id, workspaceId: session.workspaceId },
      include: { transactions: { include: { entries: true } } },
    });
    if (!job) throw new Error("Trabalho não encontrado.");

    const accountIds = job.transactions
      .flatMap((t) => t.entries.map((e) => e.accountId))
      .filter(Boolean) as string[];

    // As receitas geradas por este trabalho vão com ele (soft delete).
    await tx.transaction.updateMany({
      where: { workJobId: id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    await tx.workJob.delete({ where: { id } });

    for (const accountId of new Set(accountIds)) {
      await recomputeAccountBalance(tx, accountId);
    }

    await recordAudit(
      {
        action: "workjob.deleted",
        workspaceId: session.workspaceId,
        userId: session.userId,
        userEmail: session.email,
        entity: "WorkJob",
        entityId: id,
        metadata: { clientName: job.clientName, grossCents: job.grossCents },
      },
      tx,
    );
  });
}
