import "server-only";
import { z } from "zod";
import { prisma } from "@/server/db";
import { recordAudit } from "@/server/audit";
import { fromIso, isValidIsoDate, startOfMonth, type IsoDate } from "@/lib/date";
import type { SessionUser } from "@/server/auth/session";

export const budgetInput = z.object({
  month: z.string().refine(isValidIsoDate, "Mês inválido"),
  lines: z.array(
    z.object({
      categoryId: z.string().min(1),
      plannedCents: z.number().int().min(0).max(2_147_483_647),
    }),
  ),
});

/**
 * Grava o orçamento do mês. Linhas a zero são removidas — um orçamento de
 * €0,00 numa categoria não quer dizer "não posso gastar nada", quer dizer
 * "não orçamentei isto", e mostrá-lo como 0/0 seria enganador.
 */
export async function saveBudget(session: SessionUser, raw: unknown) {
  const input = budgetInput.parse(raw);
  const month = startOfMonth(input.month as IsoDate);

  const categoryIds = input.lines.map((l) => l.categoryId);
  if (categoryIds.length > 0) {
    const valid = await prisma.category.count({
      where: {
        workspaceId: session.workspaceId,
        id: { in: categoryIds },
        type: "EXPENSE",
      },
    });
    if (valid !== new Set(categoryIds).size) {
      throw new Error("Categoria inválida no orçamento.");
    }
  }

  await prisma.$transaction(async (tx) => {
    const budget = await tx.budget.upsert({
      where: {
        workspaceId_month: {
          workspaceId: session.workspaceId,
          month: fromIso(month),
        },
      },
      create: { workspaceId: session.workspaceId, month: fromIso(month) },
      update: {},
    });

    await tx.budgetLine.deleteMany({ where: { budgetId: budget.id } });

    const lines = input.lines.filter((l) => l.plannedCents > 0);
    if (lines.length > 0) {
      await tx.budgetLine.createMany({
        data: lines.map((l) => ({
          budgetId: budget.id,
          categoryId: l.categoryId,
          plannedCents: l.plannedCents,
        })),
      });
    }

    await recordAudit(
      {
        action: "budget.updated",
        workspaceId: session.workspaceId,
        userId: session.userId,
        userEmail: session.email,
        entity: "Budget",
        entityId: budget.id,
        metadata: {
          month,
          categorias: lines.length,
          totalCents: lines.reduce((s, l) => s + l.plannedCents, 0),
        },
      },
      tx,
    );
  });
}

export async function getBudgetLines(workspaceId: string, month: IsoDate) {
  const budget = await prisma.budget.findUnique({
    where: {
      workspaceId_month: {
        workspaceId,
        month: fromIso(startOfMonth(month)),
      },
    },
    include: { lines: true },
  });
  return new Map(
    (budget?.lines ?? []).map((l) => [l.categoryId, l.plannedCents]),
  );
}
