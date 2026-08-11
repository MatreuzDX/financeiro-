import "server-only";
import { z } from "zod";
import { prisma } from "@/server/db";
import { recordAudit } from "@/server/audit";
import { recomputeAccountBalance } from "@/server/ledger";
import type { SessionUser } from "@/server/auth/session";

export const ACCOUNT_TYPE_LABELS = {
  BANK: "Conta bancária",
  CASH: "Dinheiro",
  CARD: "Cartão de crédito",
  SAVINGS: "Poupança",
  INVESTMENT: "Investimento",
  LOAN: "Empréstimo",
  OTHER: "Outra",
} as const;

export const accountInput = z.object({
  name: z.string().trim().min(1, "Dê um nome à conta").max(60),
  type: z.enum([
    "BANK",
    "CASH",
    "CARD",
    "SAVINGS",
    "INVESTMENT",
    "LOAN",
    "OTHER",
  ]),
  institution: z.string().trim().max(60).optional().nullable(),
  openingCents: z.number().int().min(-2_147_483_647).max(2_147_483_647),
});

export type AccountInput = z.infer<typeof accountInput>;

export async function listAccounts(workspaceId: string, includeArchived = false) {
  return prisma.account.findMany({
    where: { workspaceId, ...(includeArchived ? {} : { archived: false }) },
    orderBy: [{ archived: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function createAccount(session: SessionUser, raw: unknown) {
  const input = accountInput.parse(raw);

  const duplicate = await prisma.account.findFirst({
    where: { workspaceId: session.workspaceId, name: input.name },
    select: { id: true },
  });
  if (duplicate) throw new Error("Já existe uma conta com esse nome.");

  const account = await prisma.account.create({
    data: {
      workspaceId: session.workspaceId,
      name: input.name,
      type: input.type,
      institution: input.institution || null,
      openingCents: input.openingCents,
      // O saldo começa igual ao saldo inicial; passa a ser recalculado a
      // partir dos lançamentos assim que houver algum.
      cachedBalanceCents: input.openingCents,
    },
  });

  await recordAudit({
    action: "account.created",
    workspaceId: session.workspaceId,
    userId: session.userId,
    userEmail: session.email,
    entity: "Account",
    entityId: account.id,
    metadata: { name: account.name, type: account.type },
  });

  return account;
}

export async function updateAccount(
  session: SessionUser,
  id: string,
  raw: unknown,
) {
  const input = accountInput.parse(raw);

  const existing = await prisma.account.findFirst({
    where: { id, workspaceId: session.workspaceId },
  });
  if (!existing) throw new Error("Conta não encontrada.");

  await prisma.$transaction(async (tx) => {
    await tx.account.update({
      where: { id },
      data: {
        name: input.name,
        type: input.type,
        institution: input.institution || null,
        openingCents: input.openingCents,
      },
    });
    // Mudar o saldo inicial muda o saldo atual — tem de ser recalculado.
    await recomputeAccountBalance(tx, id);
    await recordAudit(
      {
        action: "account.updated",
        workspaceId: session.workspaceId,
        userId: session.userId,
        userEmail: session.email,
        entity: "Account",
        entityId: id,
        metadata: {
          antes: { name: existing.name, openingCents: existing.openingCents },
          depois: { name: input.name, openingCents: input.openingCents },
        },
      },
      tx,
    );
  });
}

/**
 * Nunca se apaga uma conta com movimentos — arquiva-se. O histórico continua
 * a fazer sentido e os totais do passado não mudam por baixo dos pés.
 */
export async function archiveAccount(session: SessionUser, id: string) {
  const account = await prisma.account.findFirst({
    where: { id, workspaceId: session.workspaceId },
  });
  if (!account) throw new Error("Conta não encontrada.");

  await prisma.account.update({
    where: { id },
    data: { archived: !account.archived },
  });

  await recordAudit({
    action: "account.archived",
    workspaceId: session.workspaceId,
    userId: session.userId,
    userEmail: session.email,
    entity: "Account",
    entityId: id,
    metadata: { name: account.name, arquivada: !account.archived },
  });
}
