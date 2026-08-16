import "server-only";
import { z } from "zod";
import { prisma } from "@/server/db";
import { recordAudit } from "@/server/audit";
import type { SessionUser } from "@/server/auth/session";

export const categoryInput = z.object({
  name: z.string().trim().min(1, "Dê um nome à categoria").max(60),
  type: z.enum(["INCOME", "EXPENSE"]),
  scope: z.enum(["PERSONAL", "BUSINESS"]).default("PERSONAL"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida")
    .optional()
    .nullable(),
  icon: z.string().trim().max(40).optional().nullable(),
});

export async function listCategories(
  workspaceId: string,
  type?: "INCOME" | "EXPENSE",
  includeArchived = false,
) {
  return prisma.category.findMany({
    where: {
      workspaceId,
      ...(type ? { type } : {}),
      ...(includeArchived ? {} : { archived: false }),
    },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function createCategory(session: SessionUser, raw: unknown) {
  const input = categoryInput.parse(raw);

  const duplicate = await prisma.category.findFirst({
    where: {
      workspaceId: session.workspaceId,
      name: input.name,
      type: input.type,
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new Error(
      `Já existe uma categoria de ${input.type === "INCOME" ? "receita" : "despesa"} com esse nome.`,
    );
  }

  const category = await prisma.category.create({
    data: {
      workspaceId: session.workspaceId,
      name: input.name,
      type: input.type,
      scope: input.scope,
      color: input.color || null,
      icon: input.icon || null,
    },
  });

  await recordAudit({
    action: "category.created",
    workspaceId: session.workspaceId,
    userId: session.userId,
    userEmail: session.email,
    entity: "Category",
    entityId: category.id,
    metadata: { name: category.name, type: category.type },
  });

  return category;
}

export async function updateCategory(
  session: SessionUser,
  id: string,
  raw: unknown,
) {
  const input = categoryInput.parse(raw);
  const existing = await prisma.category.findFirst({
    where: { id, workspaceId: session.workspaceId },
  });
  if (!existing) throw new Error("Categoria não encontrada.");

  // Mudar o tipo de uma categoria com movimentos transformaria receitas em
  // despesas retroativamente. Não é uma edição — é reescrever o passado.
  if (existing.type !== input.type) {
    const used = await prisma.entry.count({ where: { categoryId: id } });
    if (used > 0) {
      throw new Error(
        "Não é possível mudar o tipo de uma categoria já usada em movimentos. Crie uma categoria nova.",
      );
    }
  }

  await prisma.category.update({
    where: { id },
    data: {
      name: input.name,
      type: input.type,
      scope: input.scope,
      color: input.color || null,
      icon: input.icon || null,
    },
  });

  await recordAudit({
    action: "category.updated",
    workspaceId: session.workspaceId,
    userId: session.userId,
    userEmail: session.email,
    entity: "Category",
    entityId: id,
    metadata: { antes: existing.name, depois: input.name },
  });
}

export async function archiveCategory(session: SessionUser, id: string) {
  const category = await prisma.category.findFirst({
    where: { id, workspaceId: session.workspaceId },
  });
  if (!category) throw new Error("Categoria não encontrada.");

  await prisma.category.update({
    where: { id },
    data: { archived: !category.archived },
  });

  await recordAudit({
    action: "category.archived",
    workspaceId: session.workspaceId,
    userId: session.userId,
    userEmail: session.email,
    entity: "Category",
    entityId: id,
    metadata: { name: category.name, arquivada: !category.archived },
  });
}

/**
 * As categorias de despesa que a pessoa mais usa, para o registo rápido.
 *
 * Ordenadas por NÚMERO DE VEZES, não por valor: quem regista muitos cafés e
 * uma renda quer o café à mão, não a renda. E não por ordem alfabética, que
 * poria "Água" primeiro para toda a gente.
 *
 * Quem ainda não tem histórico recebe as primeiras da lista — melhor do que
 * um ecrã vazio no primeiro registo, que é justamente o que se quer facilitar.
 */
export async function categoriasMaisUsadas(
  workspaceId: string,
  limite = 10,
): Promise<{ id: string; name: string; color: string | null }[]> {
  const usadas = await prisma.entry.groupBy({
    by: ["categoryId"],
    _count: { categoryId: true },
    where: {
      workspaceId,
      category: { type: "EXPENSE", archived: false },
      transaction: { deletedAt: null },
    },
    orderBy: { _count: { categoryId: "desc" } },
    take: limite,
  });

  const ids = usadas.map((u) => u.categoryId).filter(Boolean) as string[];

  const categorias = await prisma.category.findMany({
    where: {
      workspaceId,
      type: "EXPENSE",
      archived: false,
      ...(ids.length > 0 ? { id: { in: ids } } : {}),
    },
    select: { id: true, name: true, color: true },
    orderBy: { sortOrder: "asc" },
    take: limite,
  });

  if (ids.length === 0) return categorias;

  // Repor a ordem de utilização, que o findMany perdeu.
  const posicao = new Map(ids.map((id, i) => [id, i]));
  return categorias.sort(
    (a, b) => (posicao.get(a.id) ?? 99) - (posicao.get(b.id) ?? 99),
  );
}
