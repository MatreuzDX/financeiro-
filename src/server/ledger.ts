/**
 * O livro de lançamentos.
 *
 * Este módulo é o único que escreve movimentos. Traduz o que a pessoa vê
 * — Despesa, Receita, Transferência — nas linhas equilibradas que a base de
 * dados exige.
 *
 *   Despesa 50€ no cartão:
 *     Entry(account = cartão)        −5000
 *     Entry(category = Alimentação)  +5000
 *
 *   Receita 920€ no banco:
 *     Entry(account = banco)         +92000
 *     Entry(category = Ordenado)     −92000
 *
 *   Transferência 200€ ordem → poupança:
 *     Entry(account = ordem)         −20000
 *     Entry(account = poupança)      +20000
 *     ↑ nenhuma categoria envolvida, por isso NÃO mexe em receitas nem em
 *       despesas nem no lucro. É esta a razão de todo este trabalho.
 *
 * Convenção do sinal: positivo = dinheiro entra no recipiente daquela linha.
 */

import "server-only";
import { Prisma, type Scope, type TransactionType } from "@prisma/client";
import { z } from "zod";
import { prisma, type Tx } from "@/server/db";
import { recordAudit } from "@/server/audit";
import { assertCents } from "@/lib/money";
import { fromIso, isValidIsoDate, toIso, type IsoDate } from "@/lib/date";
import type { SessionUser } from "@/server/auth/session";

export class LedgerError extends Error {}

// ─── Entrada validada ──────────────────────────────────────────────────────

const isoDate = z.string().refine(isValidIsoDate, "Data inválida");
const positiveCents = z
  .number()
  .int("O valor tem de ser um número inteiro de cêntimos")
  .positive("O valor tem de ser maior do que zero")
  .max(2_147_483_647, "Valor demasiado alto");

const baseFields = {
  date: isoDate,
  description: z.string().trim().min(1, "Escreva uma descrição").max(200),
  amountCents: positiveCents,
  notes: z.string().trim().max(2000).optional().nullable(),
  scope: z.enum(["PERSONAL", "BUSINESS"]).default("PERSONAL"),
};

export const expenseInput = z.object({
  ...baseFields,
  type: z.literal("EXPENSE"),
  accountId: z.string().min(1, "Escolha a conta"),
  categoryId: z.string().min(1, "Escolha a categoria"),
  vehicleId: z.string().min(1).optional().nullable(),
});

export const incomeInput = z.object({
  ...baseFields,
  type: z.literal("INCOME"),
  accountId: z.string().min(1, "Escolha a conta"),
  categoryId: z.string().min(1, "Escolha a categoria"),
  incomeSourceId: z.string().min(1).optional().nullable(),
  vehicleId: z.string().min(1).optional().nullable(),
  workJobId: z.string().min(1).optional().nullable(),
});

export const transferInput = z
  .object({
    ...baseFields,
    type: z.literal("TRANSFER"),
    fromAccountId: z.string().min(1, "Escolha a conta de origem"),
    toAccountId: z.string().min(1, "Escolha a conta de destino"),
  })
  .refine((v) => v.fromAccountId !== v.toAccountId, {
    message: "A conta de origem e a de destino têm de ser diferentes",
    path: ["toAccountId"],
  });

export const transactionInput = z.discriminatedUnion("type", [
  expenseInput,
  incomeInput,
  transferInput,
]);

export type TransactionInput = z.infer<typeof transactionInput>;

// ─── Escopo: nada atravessa a fronteira do workspace ───────────────────────

/**
 * Confirma que todos os identificadores recebidos pertencem ao workspace da
 * sessão. Sem isto, bastava adulterar um `accountId` num formulário para
 * escrever na conta de outra pessoa.
 *
 * Repare-se que `workspaceId` NUNCA vem do input — vem sempre da sessão.
 */
async function assertBelongsToWorkspace(
  tx: Tx,
  workspaceId: string,
  ids: {
    accountIds?: (string | null | undefined)[];
    categoryIds?: (string | null | undefined)[];
    incomeSourceId?: string | null;
    vehicleId?: string | null;
    workJobId?: string | null;
  },
): Promise<void> {
  const accountIds = (ids.accountIds ?? []).filter(Boolean) as string[];
  if (accountIds.length > 0) {
    const found = await tx.account.count({
      where: { workspaceId, id: { in: accountIds }, archived: false },
    });
    if (found !== new Set(accountIds).size) {
      throw new LedgerError("Conta inválida ou arquivada.");
    }
  }

  const categoryIds = (ids.categoryIds ?? []).filter(Boolean) as string[];
  if (categoryIds.length > 0) {
    const found = await tx.category.count({
      where: { workspaceId, id: { in: categoryIds }, archived: false },
    });
    if (found !== new Set(categoryIds).size) {
      throw new LedgerError("Categoria inválida ou arquivada.");
    }
  }

  if (ids.incomeSourceId) {
    const found = await tx.incomeSource.count({
      where: { workspaceId, id: ids.incomeSourceId },
    });
    if (found === 0) throw new LedgerError("Fonte de rendimento inválida.");
  }

  if (ids.vehicleId) {
    const found = await tx.vehicle.count({
      where: { workspaceId, id: ids.vehicleId },
    });
    if (found === 0) throw new LedgerError("Veículo inválido.");
  }

  if (ids.workJobId) {
    const found = await tx.workJob.count({
      where: { workspaceId, id: ids.workJobId },
    });
    if (found === 0) throw new LedgerError("Trabalho inválido.");
  }
}

/** Confirma que a categoria é do tipo certo para o movimento. */
async function assertCategoryType(
  tx: Tx,
  categoryId: string,
  expected: "INCOME" | "EXPENSE",
): Promise<void> {
  const category = await tx.category.findUnique({
    where: { id: categoryId },
    select: { type: true },
  });
  if (!category || category.type !== expected) {
    throw new LedgerError(
      expected === "EXPENSE"
        ? "Essa categoria é de receitas — escolha uma categoria de despesa."
        : "Essa categoria é de despesas — escolha uma categoria de receita.",
    );
  }
}

// ─── Composição das linhas ─────────────────────────────────────────────────

type EntryDraft = {
  accountId?: string;
  categoryId?: string;
  amountCents: number;
};

export function composeEntries(input: TransactionInput): EntryDraft[] {
  assertCents(input.amountCents);
  switch (input.type) {
    case "EXPENSE":
      return [
        { accountId: input.accountId, amountCents: -input.amountCents },
        { categoryId: input.categoryId, amountCents: input.amountCents },
      ];
    case "INCOME":
      return [
        { accountId: input.accountId, amountCents: input.amountCents },
        { categoryId: input.categoryId, amountCents: -input.amountCents },
      ];
    case "TRANSFER":
      return [
        { accountId: input.fromAccountId, amountCents: -input.amountCents },
        { accountId: input.toAccountId, amountCents: input.amountCents },
      ];
  }
}

// ─── Saldos ────────────────────────────────────────────────────────────────

/**
 * Recalcula o saldo de uma conta a partir dos lançamentos, do zero.
 *
 * Movimentos apagados (soft delete) e agendados NÃO contam: dinheiro que
 * ainda não saiu não pode aparecer como se tivesse saído.
 *
 * É mais barato somar incrementalmente, mas recalcular do zero elimina uma
 * classe inteira de bugs — o saldo nunca "deriva" ao longo do tempo.
 */
export async function recomputeAccountBalance(
  tx: Tx,
  accountId: string,
): Promise<number> {
  const account = await tx.account.findUnique({
    where: { id: accountId },
    select: { openingCents: true },
  });
  if (!account) return 0;

  const agg = await tx.entry.aggregate({
    _sum: { amountCents: true },
    where: {
      accountId,
      transaction: { deletedAt: null, status: "CLEARED" },
    },
  });

  const balance = account.openingCents + (agg._sum.amountCents ?? 0);
  await tx.account.update({
    where: { id: accountId },
    data: { cachedBalanceCents: balance },
  });
  return balance;
}

async function recomputeMany(tx: Tx, accountIds: string[]): Promise<void> {
  for (const id of new Set(accountIds)) {
    await recomputeAccountBalance(tx, id);
  }
}

// ─── Operações ─────────────────────────────────────────────────────────────

export async function createTransaction(
  session: SessionUser,
  raw: unknown,
): Promise<{ id: string }> {
  const input = transactionInput.parse(raw);
  const entries = composeEntries(input);

  const created = await prisma.$transaction(async (tx) => {
    await assertBelongsToWorkspace(tx, session.workspaceId, {
      accountIds: entries.map((e) => e.accountId),
      categoryIds: entries.map((e) => e.categoryId),
      incomeSourceId: "incomeSourceId" in input ? input.incomeSourceId : null,
      vehicleId: "vehicleId" in input ? input.vehicleId : null,
      workJobId: "workJobId" in input ? input.workJobId : null,
    });

    if (input.type === "EXPENSE") {
      await assertCategoryType(tx, input.categoryId, "EXPENSE");
    } else if (input.type === "INCOME") {
      await assertCategoryType(tx, input.categoryId, "INCOME");
    }

    const transaction = await tx.transaction.create({
      data: {
        workspaceId: session.workspaceId,
        date: fromIso(input.date as IsoDate),
        type: input.type as TransactionType,
        scope: input.scope as Scope,
        description: input.description,
        notes: input.notes || null,
        incomeSourceId:
          "incomeSourceId" in input ? (input.incomeSourceId ?? null) : null,
        vehicleId: "vehicleId" in input ? (input.vehicleId ?? null) : null,
        workJobId: "workJobId" in input ? (input.workJobId ?? null) : null,
        createdById: session.userId,
        entries: {
          create: entries.map((e) => ({
            workspaceId: session.workspaceId,
            accountId: e.accountId ?? null,
            categoryId: e.categoryId ?? null,
            amountCents: e.amountCents,
          })),
        },
      },
      select: { id: true },
    });

    await recomputeMany(
      tx,
      entries.map((e) => e.accountId).filter(Boolean) as string[],
    );

    await recordAudit(
      {
        action: "transaction.created",
        workspaceId: session.workspaceId,
        userId: session.userId,
        userEmail: session.email,
        entity: "Transaction",
        entityId: transaction.id,
        metadata: {
          type: input.type,
          amountCents: input.amountCents,
          date: input.date,
          description: input.description,
        },
      },
      tx,
    );

    return transaction;
  });

  return created;
}

export async function updateTransaction(
  session: SessionUser,
  id: string,
  raw: unknown,
): Promise<void> {
  const input = transactionInput.parse(raw);
  const entries = composeEntries(input);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findFirst({
      where: { id, workspaceId: session.workspaceId, deletedAt: null },
      include: { entries: { select: { accountId: true, amountCents: true } } },
    });
    if (!existing) throw new LedgerError("Movimento não encontrado.");

    await assertBelongsToWorkspace(tx, session.workspaceId, {
      accountIds: entries.map((e) => e.accountId),
      categoryIds: entries.map((e) => e.categoryId),
      incomeSourceId: "incomeSourceId" in input ? input.incomeSourceId : null,
      vehicleId: "vehicleId" in input ? input.vehicleId : null,
    });

    if (input.type === "EXPENSE") {
      await assertCategoryType(tx, input.categoryId, "EXPENSE");
    } else if (input.type === "INCOME") {
      await assertCategoryType(tx, input.categoryId, "INCOME");
    }

    const touchedAccounts = [
      ...existing.entries.map((e) => e.accountId),
      ...entries.map((e) => e.accountId),
    ].filter(Boolean) as string[];

    // Substituir as linhas em bloco. A constraint de soma-zero é DEFERRED,
    // por isso o estado intermédio (zero linhas) não faz a operação falhar.
    await tx.entry.deleteMany({ where: { transactionId: id } });
    await tx.transaction.update({
      where: { id },
      data: {
        date: fromIso(input.date as IsoDate),
        type: input.type as TransactionType,
        scope: input.scope as Scope,
        description: input.description,
        notes: input.notes || null,
        incomeSourceId:
          "incomeSourceId" in input ? (input.incomeSourceId ?? null) : null,
        vehicleId: "vehicleId" in input ? (input.vehicleId ?? null) : null,
        revision: { increment: 1 },
        entries: {
          create: entries.map((e) => ({
            workspaceId: session.workspaceId,
            accountId: e.accountId ?? null,
            categoryId: e.categoryId ?? null,
            amountCents: e.amountCents,
          })),
        },
      },
    });

    await recomputeMany(tx, touchedAccounts);

    await recordAudit(
      {
        action: "transaction.updated",
        workspaceId: session.workspaceId,
        userId: session.userId,
        userEmail: session.email,
        entity: "Transaction",
        entityId: id,
        metadata: {
          antes: {
            description: existing.description,
            date: toIso(existing.date),
            amountCents: Math.abs(existing.entries[0]?.amountCents ?? 0),
          },
          depois: {
            description: input.description,
            date: input.date,
            amountCents: input.amountCents,
          },
        },
      },
      tx,
    );
  });
}

/**
 * Apagar é sempre "soft": a linha fica na base, deixa de contar para saldos e
 * totais, e a auditoria guarda o que era. Nunca se perde o histórico.
 */
export async function deleteTransaction(
  session: SessionUser,
  id: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findFirst({
      where: { id, workspaceId: session.workspaceId, deletedAt: null },
      include: { entries: { select: { accountId: true, amountCents: true } } },
    });
    if (!existing) throw new LedgerError("Movimento não encontrado.");

    await tx.transaction.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await recomputeMany(
      tx,
      existing.entries.map((e) => e.accountId).filter(Boolean) as string[],
    );

    await recordAudit(
      {
        action: "transaction.deleted",
        workspaceId: session.workspaceId,
        userId: session.userId,
        userEmail: session.email,
        entity: "Transaction",
        entityId: id,
        metadata: {
          description: existing.description,
          date: toIso(existing.date),
          type: existing.type,
          amountCents: Math.abs(existing.entries[0]?.amountCents ?? 0),
        },
      },
      tx,
    );
  });
}

// ─── Leitura ───────────────────────────────────────────────────────────────

export type TransactionRow = {
  id: string;
  date: IsoDate;
  type: TransactionType;
  scope: Scope;
  description: string;
  notes: string | null;
  amountCents: number;
  accountId: string | null;
  accountName: string | null;
  toAccountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  incomeSourceName: string | null;
  vehicleName: string | null;
};

const rowInclude = {
  entries: {
    include: {
      account: { select: { id: true, name: true } },
      category: { select: { id: true, name: true, color: true } },
    },
  },
  incomeSource: { select: { name: true } },
  vehicle: { select: { name: true } },
} satisfies Prisma.TransactionInclude;

type RowWithRelations = Prisma.TransactionGetPayload<{ include: typeof rowInclude }>;

function toRow(t: RowWithRelations): TransactionRow {
  const accountEntries = t.entries.filter((e) => e.accountId);
  const categoryEntry = t.entries.find((e) => e.categoryId);

  // O valor mostrado é sempre positivo; é o tipo que diz o sentido.
  const amountCents = Math.abs(
    t.type === "TRANSFER"
      ? (accountEntries.find((e) => e.amountCents > 0)?.amountCents ?? 0)
      : (categoryEntry?.amountCents ?? accountEntries[0]?.amountCents ?? 0),
  );

  const fromAccount =
    t.type === "TRANSFER"
      ? accountEntries.find((e) => e.amountCents < 0)?.account
      : accountEntries[0]?.account;
  const toAccount =
    t.type === "TRANSFER"
      ? accountEntries.find((e) => e.amountCents > 0)?.account
      : null;

  return {
    id: t.id,
    date: toIso(t.date),
    type: t.type,
    scope: t.scope,
    description: t.description,
    notes: t.notes,
    amountCents,
    accountId: fromAccount?.id ?? null,
    accountName: fromAccount?.name ?? null,
    toAccountName: toAccount?.name ?? null,
    categoryId: categoryEntry?.category?.id ?? null,
    categoryName: categoryEntry?.category?.name ?? null,
    categoryColor: categoryEntry?.category?.color ?? null,
    incomeSourceName: t.incomeSource?.name ?? null,
    vehicleName: t.vehicle?.name ?? null,
  };
}

export type TransactionFilter = {
  from?: IsoDate;
  to?: IsoDate;
  type?: TransactionType;
  scope?: Scope;
  accountId?: string;
  categoryId?: string;
  vehicleId?: string;
  incomeSourceId?: string;
  search?: string;
};

function whereFor(
  workspaceId: string,
  filter: TransactionFilter,
): Prisma.TransactionWhereInput {
  return {
    workspaceId,
    deletedAt: null,
    status: "CLEARED",
    ...(filter.from || filter.to
      ? {
          date: {
            ...(filter.from ? { gte: fromIso(filter.from) } : {}),
            ...(filter.to ? { lte: fromIso(filter.to) } : {}),
          },
        }
      : {}),
    ...(filter.type ? { type: filter.type } : {}),
    ...(filter.scope ? { scope: filter.scope } : {}),
    ...(filter.vehicleId ? { vehicleId: filter.vehicleId } : {}),
    ...(filter.incomeSourceId ? { incomeSourceId: filter.incomeSourceId } : {}),
    ...(filter.accountId
      ? { entries: { some: { accountId: filter.accountId } } }
      : {}),
    ...(filter.categoryId
      ? { entries: { some: { categoryId: filter.categoryId } } }
      : {}),
    ...(filter.search
      ? {
          OR: [
            { description: { contains: filter.search, mode: "insensitive" } },
            { notes: { contains: filter.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export async function listTransactions(
  workspaceId: string,
  filter: TransactionFilter = {},
  options: { take?: number; skip?: number } = {},
): Promise<{ rows: TransactionRow[]; total: number }> {
  const where = whereFor(workspaceId, filter);
  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: rowInclude,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: options.take ?? 50,
      skip: options.skip ?? 0,
    }),
    prisma.transaction.count({ where }),
  ]);
  return { rows: items.map(toRow), total };
}

export async function getTransaction(
  workspaceId: string,
  id: string,
): Promise<TransactionRow | null> {
  const found = await prisma.transaction.findFirst({
    where: { id, workspaceId, deletedAt: null },
    include: rowInclude,
  });
  return found ? toRow(found) : null;
}
