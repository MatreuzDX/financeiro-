/**
 * Criação de contas e do espaço de trabalho.
 *
 * Cada utilizador nasce com um Workspace próprio e com as categorias base em
 * português. Um dashboard totalmente vazio, sem nada onde clicar, é a forma
 * mais rápida de alguém desistir de uma app financeira.
 *
 * As categorias base são `isSystem` apenas para efeitos de apresentação —
 * podem ser renomeadas e arquivadas na mesma. Nada aqui é fixo: tudo é
 * editável pela pessoa.
 */

import "server-only";
import type { Role } from "@prisma/client";
import { prisma } from "@/server/db";
import { hashPassword } from "@/server/auth/password";

type SeedCategory = {
  name: string;
  color: string;
  scope?: "PERSONAL" | "BUSINESS";
};

export const DEFAULT_EXPENSE_CATEGORIES: SeedCategory[] = [
  { name: "Alimentação", color: "#f97316" },
  { name: "Supermercado", color: "#f59e0b" },
  { name: "Renda", color: "#6366f1" },
  { name: "Água", color: "#0ea5e9" },
  { name: "Eletricidade", color: "#eab308" },
  { name: "Gás", color: "#f43f5e" },
  { name: "Internet", color: "#8b5cf6" },
  { name: "Telefone", color: "#a855f7" },
  { name: "Transportes", color: "#14b8a6" },
  { name: "Saúde", color: "#ef4444" },
  { name: "Lazer", color: "#ec4899" },
  { name: "Compras", color: "#d946ef" },
  { name: "Subscrições", color: "#7c3aed" },
  { name: "Educação", color: "#3b82f6" },
  { name: "Viagens", color: "#06b6d4" },
  // Veículo — separadas para o custo por quilómetro poder ser calculado.
  { name: "Combustível", color: "#dc2626", scope: "BUSINESS" },
  { name: "Manutenção", color: "#b91c1c", scope: "BUSINESS" },
  { name: "Seguro", color: "#7f1d1d", scope: "BUSINESS" },
  { name: "Pneus", color: "#991b1b", scope: "BUSINESS" },
  { name: "Óleo", color: "#a16207", scope: "BUSINESS" },
  { name: "Reparações", color: "#c2410c", scope: "BUSINESS" },
  { name: "Impostos", color: "#57534e", scope: "BUSINESS" },
  { name: "Estacionamento", color: "#78716c", scope: "BUSINESS" },
  { name: "Outras despesas", color: "#64748b" },
];

export const DEFAULT_INCOME_CATEGORIES: SeedCategory[] = [
  { name: "Ordenado", color: "#22c55e" },
  { name: "Entregas", color: "#10b981", scope: "BUSINESS" },
  { name: "Freelancer", color: "#059669", scope: "BUSINESS" },
  { name: "Negócio", color: "#047857", scope: "BUSINESS" },
  { name: "Reembolsos", color: "#84cc16" },
  { name: "Outras receitas", color: "#65a30d" },
];

export async function seedDefaultCategories(workspaceId: string) {
  const rows = [
    ...DEFAULT_EXPENSE_CATEGORIES.map((c, i) => ({
      workspaceId,
      name: c.name,
      type: "EXPENSE" as const,
      scope: c.scope ?? ("PERSONAL" as const),
      color: c.color,
      sortOrder: i,
      isSystem: true,
    })),
    ...DEFAULT_INCOME_CATEGORIES.map((c, i) => ({
      workspaceId,
      name: c.name,
      type: "INCOME" as const,
      scope: c.scope ?? ("PERSONAL" as const),
      color: c.color,
      sortOrder: i,
      isSystem: true,
    })),
  ];
  await prisma.category.createMany({ data: rows, skipDuplicates: true });
}

export async function createUserWithWorkspace(input: {
  name: string;
  email: string;
  password: string;
  role?: Role;
  workspaceName?: string;
  mustChangePassword?: boolean;
}) {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: input.name.trim(),
        email,
        passwordHash,
        role: input.role ?? "OWNER",
        mustChangePassword: input.mustChangePassword ?? false,
      },
    });

    const workspace = await tx.workspace.create({
      data: {
        name: input.workspaceName ?? `Finanças de ${input.name.trim()}`,
        memberships: { create: { userId: created.id, role: "OWNER" } },
      },
    });

    await tx.user.update({
      where: { id: created.id },
      data: { activeWorkspaceId: workspace.id },
    });

    return { ...created, workspaceId: workspace.id };
  });

  await seedDefaultCategories(user.workspaceId);
  return user;
}
