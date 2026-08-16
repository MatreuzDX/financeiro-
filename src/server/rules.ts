/**
 * Regras de categorização.
 *
 * "Se a descrição contiver PINGO DOCE, é Supermercado."
 *
 * É a ideia do motor de regras do Firefly III reduzida ao que realmente
 * resolve o problema. Deliberadamente NÃO há expressões regulares, nem
 * condições sobre valor, conta ou data, nem E/OU entre condições. Quem acaba
 * de descarregar um extrato do banco quer categorizar duzentas linhas, não
 * aprender uma linguagem.
 *
 * A regra aprende-se sozinha: quando alguém categoriza uma linha na
 * importação, propõe-se guardar o comerciante como regra. Da segunda vez, já
 * vem preenchido.
 */

import "server-only";
import { z } from "zod";
import { prisma } from "@/server/db";
import { recordAudit } from "@/server/audit";
import { normalize } from "@/lib/csv";
import type { SessionUser } from "@/server/auth/session";

export class RuleError extends Error {}

export type RuleRow = {
  id: string;
  label: string;
  pattern: string;
  categoryId: string;
  categoryName: string;
  categoryType: "INCOME" | "EXPENSE";
  scope: "PERSONAL" | "BUSINESS";
  hits: number;
};

const ruleInput = z.object({
  label: z
    .string()
    .trim()
    .min(2, "Escreva pelo menos duas letras")
    .max(80, "Texto demasiado longo"),
  categoryId: z.string().min(1, "Escolha a categoria"),
  scope: z.enum(["PERSONAL", "BUSINESS"]).default("PERSONAL"),
});

export async function listRules(workspaceId: string): Promise<RuleRow[]> {
  const rules = await prisma.categoryRule.findMany({
    where: { workspaceId },
    include: { category: { select: { name: true, type: true } } },
    orderBy: [{ hits: "desc" }, { label: "asc" }],
  });

  return rules.map((r) => ({
    id: r.id,
    label: r.label,
    pattern: r.pattern,
    categoryId: r.categoryId,
    categoryName: r.category.name,
    categoryType: r.category.type,
    scope: r.scope,
    hits: r.hits,
  }));
}

export async function createRule(
  session: SessionUser,
  raw: unknown,
): Promise<RuleRow> {
  const input = ruleInput.parse(raw);
  const pattern = normalize(input.label);
  if (pattern.length < 2) {
    throw new RuleError("Escreva pelo menos duas letras.");
  }

  const category = await prisma.category.findFirst({
    where: { id: input.categoryId, workspaceId: session.workspaceId },
    select: { id: true, name: true, type: true },
  });
  if (!category) throw new RuleError("Categoria inválida.");

  const existing = await prisma.categoryRule.findUnique({
    where: { workspaceId_pattern: { workspaceId: session.workspaceId, pattern } },
  });
  if (existing) {
    throw new RuleError(`Já existe uma regra para "${input.label}".`);
  }

  const created = await prisma.categoryRule.create({
    data: {
      workspaceId: session.workspaceId,
      pattern,
      label: input.label,
      categoryId: category.id,
      scope: input.scope,
    },
  });

  await recordAudit({
    action: "rule.created",
    workspaceId: session.workspaceId,
    userId: session.userId,
    userEmail: session.email,
    entity: "CategoryRule",
    entityId: created.id,
    metadata: { label: input.label, categoria: category.name },
  });

  return {
    id: created.id,
    label: created.label,
    pattern: created.pattern,
    categoryId: category.id,
    categoryName: category.name,
    categoryType: category.type,
    scope: created.scope,
    hits: 0,
  };
}

export async function deleteRule(
  session: SessionUser,
  id: string,
): Promise<void> {
  const rule = await prisma.categoryRule.findFirst({
    where: { id, workspaceId: session.workspaceId },
    select: { id: true, label: true },
  });
  if (!rule) throw new RuleError("Regra não encontrada.");

  await prisma.categoryRule.delete({ where: { id: rule.id } });

  await recordAudit({
    action: "rule.deleted",
    workspaceId: session.workspaceId,
    userId: session.userId,
    userEmail: session.email,
    entity: "CategoryRule",
    entityId: rule.id,
    metadata: { label: rule.label },
  });
}

/**
 * Guarda uma regra sem se queixar se já existir.
 *
 * É o que a importação usa: se a pessoa categorizar quatro linhas do PINGO
 * DOCE e pedir para aprender, não faz sentido rebentar na segunda.
 */
export async function learnRule(
  workspaceId: string,
  label: string,
  categoryId: string,
  scope: "PERSONAL" | "BUSINESS",
): Promise<void> {
  const pattern = normalize(label);
  if (pattern.length < 2) return;

  await prisma.categoryRule.upsert({
    where: { workspaceId_pattern: { workspaceId, pattern } },
    create: { workspaceId, pattern, label: label.trim(), categoryId, scope },
    update: { categoryId, scope },
  });
}

// ─── Aplicar ───────────────────────────────────────────────────────────────

export type CompiledRule = {
  id: string;
  pattern: string;
  categoryId: string;
  scope: "PERSONAL" | "BUSINESS";
};

export type RuleMatch = {
  ruleId: string;
  categoryId: string;
  scope: "PERSONAL" | "BUSINESS";
};

/**
 * Encontra a regra que se aplica a uma descrição.
 *
 * PORQUÊ A MAIS LONGA GANHA: se existirem regras para "continente" e para
 * "continente bom dia", a segunda é mais específica e é a que a pessoa quis
 * distinguir. Ordenar por comprimento é a maneira mais simples de respeitar
 * isso sem inventar um campo de prioridade que ninguém vai gerir à mão.
 *
 * Função pura, para poder ser testada sem base de dados.
 */
export function matchRule(
  description: string,
  rules: readonly CompiledRule[],
): RuleMatch | null {
  const haystack = normalize(description);
  if (haystack === "") return null;

  let best: CompiledRule | null = null;
  for (const rule of rules) {
    if (!haystack.includes(rule.pattern)) continue;
    if (best === null || rule.pattern.length > best.pattern.length) {
      best = rule;
    }
  }

  if (!best) return null;
  return { ruleId: best.id, categoryId: best.categoryId, scope: best.scope };
}

export async function loadCompiledRules(
  workspaceId: string,
): Promise<CompiledRule[]> {
  const rules = await prisma.categoryRule.findMany({
    where: { workspaceId },
    select: { id: true, pattern: true, categoryId: true, scope: true },
  });
  return rules;
}

/** Conta um acerto. Não vale a pena falhar uma importação por causa disto. */
export async function countHits(ruleIds: readonly string[]): Promise<void> {
  const tally = new Map<string, number>();
  for (const id of ruleIds) tally.set(id, (tally.get(id) ?? 0) + 1);
  await Promise.all(
    [...tally].map(([id, n]) =>
      prisma.categoryRule
        .update({ where: { id }, data: { hits: { increment: n } } })
        .catch(() => {}),
    ),
  );
}
