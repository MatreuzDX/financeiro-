import "server-only";
import { z } from "zod";
import { prisma } from "@/server/db";
import { recordAudit } from "@/server/audit";
import { compararSaldo, candidatos, type Diferenca } from "@/lib/reconciliacao";
import { listTransactions } from "@/server/ledger";
import { addDays, fromIso, toIso, todayIso, type IsoDate } from "@/lib/date";
import type { SessionUser } from "@/server/auth/session";

export class ReconError extends Error {}

export type EstadoConta = {
  accountId: string;
  nome: string;
  appCents: number;
  /** Última vez que alguém conferiu esta conta. */
  ultima: { date: IsoDate; diffCents: number; bateu: boolean } | null;
  /** Dias desde a última verificação. `null` se nunca foi feita. */
  diasSemConferir: number | null;
};

export async function estadoDasContas(
  workspaceId: string,
  timezone: string,
): Promise<EstadoConta[]> {
  const hoje = todayIso(timezone);
  const contas = await prisma.account.findMany({
    where: { workspaceId, archived: false },
    select: { id: true, name: true, cachedBalanceCents: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const ultimas = await prisma.reconciliation.findMany({
    where: { workspaceId },
    orderBy: { date: "desc" },
    distinct: ["accountId"],
    select: { accountId: true, date: true, diffCents: true },
  });
  const porConta = new Map(ultimas.map((u) => [u.accountId, u]));

  return contas.map((c) => {
    const u = porConta.get(c.id);
    const date = u ? toIso(u.date) : null;
    return {
      accountId: c.id,
      nome: c.name,
      appCents: c.cachedBalanceCents,
      ultima: date
        ? { date, diffCents: u!.diffCents, bateu: u!.diffCents === 0 }
        : null,
      diasSemConferir: date
        ? Math.round(
            (fromIso(hoje).getTime() - fromIso(date).getTime()) / 86_400_000,
          )
        : null,
    };
  });
}

const conferirInput = z.object({
  accountId: z.string().min(1, "Escolha a conta"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  bankCents: z.number().int(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export type Resultado = Diferenca & {
  contaNome: string;
  /** Movimentos cujo valor bate exatamente com a diferença. */
  suspeitos: { id: string; date: IsoDate; description: string; amountCents: number }[];
};

export async function conferir(
  session: SessionUser,
  raw: unknown,
): Promise<Resultado> {
  const input = conferirInput.parse(raw);

  const conta = await prisma.account.findFirst({
    where: { id: input.accountId, workspaceId: session.workspaceId, archived: false },
    select: { id: true, name: true, cachedBalanceCents: true },
  });
  if (!conta) throw new ReconError("Escolha uma conta válida.");

  const d = compararSaldo(input.bankCents, conta.cachedBalanceCents);

  await prisma.reconciliation.create({
    data: {
      workspaceId: session.workspaceId,
      accountId: conta.id,
      date: fromIso(input.date as IsoDate),
      bankCents: input.bankCents,
      appCents: conta.cachedBalanceCents,
      diffCents: d.diferencaCents,
      notes: input.notes || null,
      createdById: session.userId,
    },
  });

  await recordAudit({
    action: "reconciliation.done",
    workspaceId: session.workspaceId,
    userId: session.userId,
    userEmail: session.email,
    entity: "Account",
    entityId: conta.id,
    metadata: { conta: conta.name, diferenca: d.diferencaCents, data: input.date },
  });

  // Procura um movimento com o valor exato da diferença nos últimos 90 dias.
  // É a causa mais vulgar: um lançamento apagado, ou com o sinal trocado.
  let suspeitos: Resultado["suspeitos"] = [];
  if (!d.bate) {
    const { rows } = await listTransactions(
      session.workspaceId,
      { from: addDays(input.date as IsoDate, -90), to: input.date as IsoDate },
      { take: 400 },
    );
    suspeitos = candidatos(d.diferencaCents, rows).map((r) => ({
      id: r.id,
      date: r.date,
      description: r.description,
      amountCents: r.amountCents,
    }));
  }

  return { ...d, contaNome: conta.name, suspeitos };
}

export async function historico(workspaceId: string, accountId?: string) {
  const linhas = await prisma.reconciliation.findMany({
    where: { workspaceId, ...(accountId ? { accountId } : {}) },
    orderBy: { date: "desc" },
    take: 12,
    select: {
      id: true,
      date: true,
      bankCents: true,
      appCents: true,
      diffCents: true,
      notes: true,
      account: { select: { name: true } },
    },
  });
  return linhas.map((l) => ({ ...l, dateIso: toIso(l.date) }));
}
