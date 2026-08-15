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
  // Vidas que a lista original não servia: quem tem casa a crédito, quem
  // tem filhos, quem paga prestações, quem tem animais. Sem uma categoria
  // onde caiba, a despesa acaba em "Outras" e o relatório não diz nada.
  { name: "Prestação da casa", color: "#4f46e5" },
  { name: "Condomínio", color: "#6366f1" },
  { name: "Seguros", color: "#0891b2" },
  { name: "Créditos e empréstimos", color: "#be123c" },
  { name: "Creche e escola", color: "#2563eb" },
  { name: "Animais", color: "#ca8a04" },
  { name: "Vestuário", color: "#db2777" },
  { name: "Impostos e taxas", color: "#475569" },
  { name: "Ofertas e apoios", color: "#9333ea" },
  { name: "Outras despesas", color: "#64748b" },
];

export const DEFAULT_INCOME_CATEGORIES: SeedCategory[] = [
  { name: "Ordenado", color: "#22c55e" },
  { name: "Entregas", color: "#10b981", scope: "BUSINESS" },
  { name: "Freelancer", color: "#059669", scope: "BUSINESS" },
  { name: "Negócio", color: "#047857", scope: "BUSINESS" },
  { name: "Arrendamento", color: "#16a34a" },
  { name: "Pensão ou reforma", color: "#15803d" },
  { name: "Apoios e subsídios", color: "#4d7c0f" },
  { name: "Bolsa de estudo", color: "#3f6212" },
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

/** Há alguém registado? Decide se a app mostra o login ou a instalação. */
export async function hasAnyUser(): Promise<boolean> {
  return (await prisma.user.count()) > 0;
}

/**
 * Cria a PRIMEIRA conta — a do dono — a partir da própria aplicação.
 *
 * Existe para não ser preciso correr comandos contra a base de produção só
 * para ter por onde entrar. Só funciona enquanto não existir nenhuma conta:
 * a partir daí, esta porta fecha-se para sempre.
 *
 * O `pg_advisory_xact_lock` serializa este caminho. Sem ele, dois pedidos
 * ao mesmo tempo podiam ver ambos "zero contas" e criar dois donos.
 */
export async function createFirstOwner(input: {
  name: string;
  email: string;
  password: string;
}) {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);

  const created = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(4242)`;

    const existing = await tx.user.count();
    if (existing > 0) {
      throw new Error(
        "Esta aplicação já tem uma conta. Entre com ela, ou peça a quem administra para criar a sua.",
      );
    }

    const user = await tx.user.create({
      data: {
        name: input.name.trim(),
        email,
        passwordHash,
        role: "OWNER",
        mustChangePassword: false,
      },
    });

    const workspace = await tx.workspace.create({
      data: {
        name: `Finanças de ${input.name.trim()}`,
        memberships: { create: { userId: user.id, role: "OWNER" } },
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { activeWorkspaceId: workspace.id },
    });

    return { ...user, workspaceId: workspace.id };
  });

  await seedDefaultCategories(created.workspaceId);
  return created;
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
