/**
 * Registo de auditoria.
 *
 * Append-only por trigger na base de dados: nem este código consegue apagar
 * ou reescrever uma linha. Ver a migração `ledger_constraints`.
 *
 * REGRA: nunca aqui palavras-passe, hashes, tokens ou cookies. Se um dia
 * alguém passar o objeto inteiro de um formulário para `metadata`, é assim
 * que um segredo acaba num registo permanente — por isso `metadata` recebe
 * campos escolhidos à mão, nunca `...input`.
 */

import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import type { Tx } from "@/server/db";

export type AuditAction =
  | "auth.login"
  | "auth.login_failed"
  | "auth.logout"
  | "auth.password_changed"
  | "auth.password_reset_requested"
  | "auth.password_reset_completed"
  | "admin.created"
  | "setup.completed"
  | "transaction.created"
  | "transaction.updated"
  | "transaction.deleted"
  | "account.created"
  | "account.updated"
  | "account.archived"
  | "category.created"
  | "category.updated"
  | "category.archived"
  | "income_source.created"
  | "income_source.updated"
  | "vehicle.created"
  | "vehicle.updated"
  | "mileage.created"
  | "fuel.created"
  | "workjob.created"
  | "workjob.deleted"
  | "budget.updated";

const FORBIDDEN_KEYS = /pass|senha|token|secret|hash|cookie|authorization/i;

/** Última linha de defesa contra guardar um segredo por distração. */
function sanitize(metadata: Record<string, unknown>): Prisma.InputJsonValue {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (FORBIDDEN_KEYS.test(key)) {
      clean[key] = "[removido]";
      continue;
    }
    if (value === undefined) continue;
    clean[key] =
      typeof value === "string" && value.length > 500
        ? `${value.slice(0, 500)}…`
        : (value as unknown);
  }
  return clean as Prisma.InputJsonValue;
}

export async function recordAudit(
  input: {
    action: AuditAction;
    workspaceId?: string | null;
    userId?: string | null;
    userEmail?: string | null;
    entity?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    ipHash?: string | null;
  },
  tx: Tx = prisma,
): Promise<void> {
  try {
    await tx.auditLog.create({
      data: {
        action: input.action,
        workspaceId: input.workspaceId ?? null,
        userId: input.userId ?? null,
        userEmail: input.userEmail ?? null,
        entity: input.entity ?? null,
        entityId: input.entityId ?? null,
        metadata: input.metadata ? sanitize(input.metadata) : undefined,
        ipHash: input.ipHash ?? null,
      },
    });
  } catch (error) {
    // A auditoria nunca pode ser a razão de uma operação falhar. Mas também
    // não pode falhar em silêncio absoluto.
    console.error("[auditoria] não foi possível registar", input.action, error);
  }
}

export const AUDIT_LABELS: Record<string, string> = {
  "auth.login": "Entrou na conta",
  "auth.login_failed": "Tentativa de entrada falhada",
  "auth.logout": "Saiu da conta",
  "auth.password_changed": "Alterou a palavra-passe",
  "auth.password_reset_requested": "Pediu recuperação de palavra-passe",
  "auth.password_reset_completed": "Redefiniu a palavra-passe",
  "admin.created": "Conta de administrador criada",
  "setup.completed": "Configuração inicial concluída",
  "transaction.created": "Movimento criado",
  "transaction.updated": "Movimento alterado",
  "transaction.deleted": "Movimento apagado",
  "account.created": "Conta criada",
  "account.updated": "Conta alterada",
  "account.archived": "Conta arquivada",
  "category.created": "Categoria criada",
  "category.updated": "Categoria alterada",
  "category.archived": "Categoria arquivada",
  "income_source.created": "Fonte de rendimento criada",
  "income_source.updated": "Fonte de rendimento alterada",
  "vehicle.created": "Veículo criado",
  "vehicle.updated": "Veículo alterado",
  "mileage.created": "Quilometragem registada",
  "fuel.created": "Abastecimento registado",
  "workjob.created": "Trabalho registado",
  "workjob.deleted": "Trabalho apagado",
  "budget.updated": "Orçamento alterado",
};
