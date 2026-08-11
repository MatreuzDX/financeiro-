import "server-only";
import { z } from "zod";
import { prisma } from "@/server/db";
import { recordAudit } from "@/server/audit";
import type { SessionUser } from "@/server/auth/session";

export const INCOME_SOURCE_TYPE_LABELS = {
  SALARY: "Ordenado",
  DELIVERY: "Entregas",
  FREELANCE: "Freelancer",
  BUSINESS: "Negócio",
  RENTAL: "Arrendamento",
  OTHER: "Outra",
} as const;

export const incomeSourceInput = z.object({
  name: z.string().trim().min(1, "Dê um nome à fonte de rendimento").max(60),
  type: z.enum([
    "SALARY",
    "DELIVERY",
    "FREELANCE",
    "BUSINESS",
    "RENTAL",
    "OTHER",
  ]),
  scope: z.enum(["PERSONAL", "BUSINESS"]).default("BUSINESS"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .nullable(),
  active: z.boolean().default(true),
});

export async function listIncomeSources(
  workspaceId: string,
  onlyActive = false,
) {
  return prisma.incomeSource.findMany({
    where: { workspaceId, ...(onlyActive ? { active: true } : {}) },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
}

export async function createIncomeSource(session: SessionUser, raw: unknown) {
  const input = incomeSourceInput.parse(raw);

  const duplicate = await prisma.incomeSource.findFirst({
    where: { workspaceId: session.workspaceId, name: input.name },
    select: { id: true },
  });
  if (duplicate) throw new Error("Já existe uma fonte com esse nome.");

  const source = await prisma.incomeSource.create({
    data: { workspaceId: session.workspaceId, ...input },
  });

  await recordAudit({
    action: "income_source.created",
    workspaceId: session.workspaceId,
    userId: session.userId,
    userEmail: session.email,
    entity: "IncomeSource",
    entityId: source.id,
    metadata: { name: source.name, type: source.type },
  });

  return source;
}

export async function updateIncomeSource(
  session: SessionUser,
  id: string,
  raw: unknown,
) {
  const input = incomeSourceInput.parse(raw);
  const existing = await prisma.incomeSource.findFirst({
    where: { id, workspaceId: session.workspaceId },
  });
  if (!existing) throw new Error("Fonte de rendimento não encontrada.");

  await prisma.incomeSource.update({ where: { id }, data: input });

  await recordAudit({
    action: "income_source.updated",
    workspaceId: session.workspaceId,
    userId: session.userId,
    userEmail: session.email,
    entity: "IncomeSource",
    entityId: id,
    metadata: { antes: existing.name, depois: input.name },
  });
}
