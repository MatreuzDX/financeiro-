/**
 * Metas de poupança.
 *
 * O progresso é a SOMA das contribuições registadas, não o saldo de uma
 * conta. Se fosse o saldo, duas metas na mesma conta mostravam ambas o
 * dinheiro todo — e a pessoa achava que tinha o dobro do que tem.
 *
 * O ritmo e a previsão de chegada saem das contribuições reais. Sem
 * contribuições não há previsão nenhuma: prefiro dizer "ainda não sei" do
 * que inventar uma data que a pessoa vai levar a sério.
 */

import "server-only";
import { z } from "zod";
import { prisma } from "@/server/db";
import { recordAudit } from "@/server/audit";
import {
  addDays,
  diffDays,
  fromIso,
  isValidIsoDate,
  toIso,
  todayIso,
  type IsoDate,
} from "@/lib/date";
import { divRound } from "@/lib/money";
import type { SessionUser } from "@/server/auth/session";

const isoDate = z.string().refine(isValidIsoDate, "Data inválida");

export const goalInput = z.object({
  name: z.string().trim().min(1, "Dê um nome à meta").max(60),
  targetCents: z
    .number()
    .int()
    .positive("O objetivo tem de ser maior do que zero")
    .max(2_147_483_647),
  deadline: isoDate.nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
});

export const contributionInput = z.object({
  goalId: z.string().min(1),
  date: isoDate,
  amountCents: z
    .number()
    .int()
    .refine((v) => v !== 0, "O valor não pode ser zero")
    .max(2_147_483_647)
    .min(-2_147_483_647),
  note: z.string().trim().max(200).nullable().optional(),
});

export type GoalRow = {
  id: string;
  name: string;
  color: string | null;
  targetCents: number;
  savedCents: number;
  faltaCents: number;
  percent: number;
  deadline: IsoDate | null;
  concluida: boolean;
  /** Média por mês das contribuições até agora. `null` se não der para saber. */
  ritmoMensalCents: number | null;
  /** Estimativa de quando chega lá, ao ritmo atual. `null` se não der. */
  previsaoIso: IsoDate | null;
  /** Quanto teria de pôr por mês para chegar ao prazo. `null` sem prazo. */
  precisoPorMesCents: number | null;
  contribuicoes: number;
};

export async function listGoals(
  workspaceId: string,
  timezone: string,
): Promise<GoalRow[]> {
  const hoje = todayIso(timezone) as IsoDate;

  const metas = await prisma.goal.findMany({
    where: { workspaceId, archived: false },
    include: { contributions: { orderBy: { date: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  return metas.map((meta) => {
    const savedCents = meta.contributions.reduce(
      (soma, c) => soma + c.amountCents,
      0,
    );
    const faltaCents = Math.max(0, meta.targetCents - savedCents);
    const percent =
      meta.targetCents > 0
        ? Math.min(100, Math.round((savedCents / meta.targetCents) * 100))
        : 0;

    // Ritmo: só faz sentido com pelo menos duas contribuições e algum tempo
    // decorrido. Com uma só, qualquer média é uma invenção.
    let ritmoMensalCents: number | null = null;
    let previsaoIso: IsoDate | null = null;

    if (meta.contributions.length >= 2 && savedCents > 0) {
      const primeira = toIso(meta.contributions[0].date);
      const dias = Math.max(1, diffDays(primeira, hoje));
      if (dias >= 14) {
        ritmoMensalCents = divRound(savedCents * 30, dias);
        if (ritmoMensalCents > 0 && faltaCents > 0) {
          const diasQueFaltam = Math.ceil(
            (faltaCents / ritmoMensalCents) * 30,
          );
          // Acima de dez anos a previsão deixa de dizer nada de útil.
          if (diasQueFaltam <= 3_650) {
            previsaoIso = addDays(hoje, diasQueFaltam);
          }
        }
      }
    }

    let precisoPorMesCents: number | null = null;
    if (meta.deadline && faltaCents > 0) {
      const prazo = toIso(meta.deadline);
      const diasAteAoPrazo = diffDays(hoje, prazo);
      if (diasAteAoPrazo > 0) {
        precisoPorMesCents = divRound(faltaCents * 30, diasAteAoPrazo);
      }
    }

    return {
      id: meta.id,
      name: meta.name,
      color: meta.color,
      targetCents: meta.targetCents,
      savedCents,
      faltaCents,
      percent,
      deadline: meta.deadline ? toIso(meta.deadline) : null,
      concluida: savedCents >= meta.targetCents,
      ritmoMensalCents,
      previsaoIso,
      precisoPorMesCents,
      contribuicoes: meta.contributions.length,
    };
  });
}

export async function createGoal(session: SessionUser, raw: unknown) {
  const input = goalInput.parse(raw);

  const duplicada = await prisma.goal.findFirst({
    where: { workspaceId: session.workspaceId, name: input.name },
    select: { id: true },
  });
  if (duplicada) throw new Error("Já existe uma meta com esse nome.");

  const meta = await prisma.goal.create({
    data: {
      workspaceId: session.workspaceId,
      name: input.name,
      targetCents: input.targetCents,
      deadline: input.deadline ? fromIso(input.deadline as IsoDate) : null,
      color: input.color || null,
    },
  });

  await recordAudit({
    action: "goal.created",
    workspaceId: session.workspaceId,
    userId: session.userId,
    userEmail: session.email,
    entity: "Goal",
    entityId: meta.id,
    metadata: { name: meta.name, targetCents: meta.targetCents },
  });

  return meta;
}

/**
 * Regista dinheiro posto de lado. Aceita valores negativos — às vezes é
 * preciso tirar da meta para uma emergência, e esconder isso só faria a
 * pessoa deixar de confiar no número.
 */
export async function addContribution(session: SessionUser, raw: unknown) {
  const input = contributionInput.parse(raw);

  const meta = await prisma.goal.findFirst({
    where: { id: input.goalId, workspaceId: session.workspaceId },
    select: { id: true, name: true },
  });
  if (!meta) throw new Error("Meta não encontrada.");

  await prisma.goalContribution.create({
    data: {
      workspaceId: session.workspaceId,
      goalId: meta.id,
      date: fromIso(input.date as IsoDate),
      amountCents: input.amountCents,
      note: input.note || null,
    },
  });

  await recordAudit({
    action: "goal.contribution",
    workspaceId: session.workspaceId,
    userId: session.userId,
    userEmail: session.email,
    entity: "Goal",
    entityId: meta.id,
    metadata: { name: meta.name, amountCents: input.amountCents },
  });
}

export async function archiveGoal(session: SessionUser, id: string) {
  const meta = await prisma.goal.findFirst({
    where: { id, workspaceId: session.workspaceId },
    select: { id: true, name: true, archived: true },
  });
  if (!meta) throw new Error("Meta não encontrada.");

  await prisma.goal.update({
    where: { id },
    data: { archived: !meta.archived },
  });

  await recordAudit({
    action: "goal.updated",
    workspaceId: session.workspaceId,
    userId: session.userId,
    userEmail: session.email,
    entity: "Goal",
    entityId: id,
    metadata: { name: meta.name, arquivada: !meta.archived },
  });
}
