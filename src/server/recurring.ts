/**
 * Recorrências e contas a pagar.
 *
 * A maior falha desta app em relação às do género: toda a gente tem renda,
 * internet e telemóvel, e ninguém quer escrever isso doze vezes por ano.
 *
 * COMO FUNCIONA, e porque é que a distinção importa:
 *
 *   RecurringRule   a regra. "Renda, 500 €, dia 1 de cada mês."
 *        ↓
 *   Transaction com status SCHEDULED   a ocorrência prevista
 *        ↓ (a pessoa confirma que pagou)
 *   Transaction com status CLEARED     o movimento a sério
 *
 * Uma ocorrência SCHEDULED **não conta** para saldos, nem para receitas,
 * nem para lucro. Conta para "o que vem aí". Dinheiro que ainda não saiu da
 * conta não pode aparecer como se tivesse saído — senão a app diz que tem
 * menos dinheiro do que tem, e a pessoa deixa de confiar nela.
 *
 * A geração é IDEMPOTENTE: há um `@@unique([recurringId, date])` na base, por
 * isso correr isto dez vezes no mesmo dia não cria dez rendas.
 */

import "server-only";
import { z } from "zod";
import { Prisma, type Frequency } from "@prisma/client";
import { prisma } from "@/server/db";
import { recordAudit } from "@/server/audit";
import { recomputeAccountBalance } from "@/server/ledger";
import {
  addDays,
  addMonths,
  daysInMonth,
  diffDays,
  fromIso,
  isValidIsoDate,
  minIso,
  toIso,
  todayIso,
  type IsoDate,
} from "@/lib/date";
import type { SessionUser } from "@/server/auth/session";

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  WEEKLY: "Todas as semanas",
  MONTHLY: "Todos os meses",
  QUARTERLY: "De três em três meses",
  YEARLY: "Uma vez por ano",
};

const isoDate = z.string().refine(isValidIsoDate, "Data inválida");

export const recurringInput = z
  .object({
    name: z.string().trim().min(1, "Dê um nome à recorrência").max(80),
    type: z.enum(["INCOME", "EXPENSE"]),
    amountCents: z
      .number()
      .int()
      .positive("O valor tem de ser maior do que zero")
      .max(2_147_483_647),
    scope: z.enum(["PERSONAL", "BUSINESS"]).default("PERSONAL"),
    accountId: z.string().min(1, "Escolha a conta"),
    categoryId: z.string().min(1, "Escolha a categoria"),
    frequency: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]),
    dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
    weekday: z.number().int().min(1).max(7).nullable().optional(),
    monthOfYear: z.number().int().min(1).max(12).nullable().optional(),
    startDate: isoDate,
    endDate: isoDate.nullable().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .refine((v) => v.frequency !== "WEEKLY" || v.weekday != null, {
    message: "Escolha o dia da semana",
    path: ["weekday"],
  })
  .refine(
    (v) => v.frequency === "WEEKLY" || v.dayOfMonth != null,
    { message: "Escolha o dia do mês", path: ["dayOfMonth"] },
  )
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    message: "O fim não pode ser antes do início",
    path: ["endDate"],
  });

export type RecurringInput = z.infer<typeof recurringInput>;

type RegraParaCalculo = {
  frequency: Frequency;
  dayOfMonth: number | null;
  weekday: number | null;
  monthOfYear: number | null;
  startDate: Date;
  endDate: Date | null;
};

/**
 * Ajusta o dia ao mês: dia 31 em fevereiro passa a 28 (ou 29).
 *
 * Sem isto, uma renda marcada para dia 31 saltava fevereiro, abril, junho,
 * setembro e novembro — cinco meses por ano em silêncio.
 */
function diaNoMes(ano: number, mesIndice: number, dia: number): IsoDate {
  const ultimo = daysInMonth(ano, mesIndice);
  const escolhido = Math.min(dia, ultimo);
  const mes = String(mesIndice + 1).padStart(2, "0");
  return `${ano}-${mes}-${String(escolhido).padStart(2, "0")}` as IsoDate;
}

/**
 * Todas as datas em que a regra ocorre, entre `de` e `ate` (inclusive).
 *
 * Função pura: não toca na base de dados, e é por isso que dá para testar
 * as passagens de ano, os meses curtos e os anos bissextos sem montar nada.
 */
export function ocorrenciasEntre(
  regra: RegraParaCalculo,
  de: IsoDate,
  ate: IsoDate,
): IsoDate[] {
  const inicio = toIso(regra.startDate);
  const fim = regra.endDate ? minIso(toIso(regra.endDate), ate) : ate;
  const desde = inicio > de ? inicio : de;
  if (desde > fim) return [];

  const datas: IsoDate[] = [];

  if (regra.frequency === "WEEKLY") {
    const alvo = regra.weekday ?? 1; // 1 = segunda … 7 = domingo
    let dia = desde;
    // Avança até ao primeiro dia da semana certo.
    for (let i = 0; i < 7; i++) {
      const d = fromIso(dia).getUTCDay(); // 0 = domingo
      const normalizado = d === 0 ? 7 : d;
      if (normalizado === alvo) break;
      dia = addDays(dia, 1);
    }
    while (dia <= fim) {
      if (dia >= inicio) datas.push(dia);
      dia = addDays(dia, 7);
    }
    return datas;
  }

  const dia = regra.dayOfMonth ?? 1;

  // BUG apanhado por teste: as anuais nunca disparavam. O cursor arrancava no
  // mês de INÍCIO e saltava 12 meses de cada vez, por isso, se a regra fosse
  // "20 de junho" e o início fosse em janeiro, o cursor batia sempre em
  // janeiro e o filtro do mês rejeitava tudo. As anuais têm de ser contadas
  // por ANO, fixando o mês, e não por saltos de 12 meses a partir do início.
  if (regra.frequency === "YEARLY") {
    const mesAlvo = regra.monthOfYear ?? fromIso(inicio).getUTCMonth() + 1;
    const primeiroAno = Number(desde.slice(0, 4));
    const ultimoAno = Number(fim.slice(0, 4));

    for (let ano = primeiroAno; ano <= ultimoAno; ano++) {
      const data = diaNoMes(ano, mesAlvo - 1, dia);
      if (data >= desde && data <= fim && data >= inicio) datas.push(data);
    }
    return datas;
  }

  const passo = regra.frequency === "QUARTERLY" ? 3 : 1;

  // Começa no mês do início e anda de `passo` em `passo`.
  let cursor = `${inicio.slice(0, 7)}-01` as IsoDate;
  const limite = `${fim.slice(0, 7)}-01`;

  while (cursor <= limite) {
    const d = fromIso(cursor);
    const data = diaNoMes(d.getUTCFullYear(), d.getUTCMonth(), dia);
    if (data >= desde && data <= fim && data >= inicio) datas.push(data);
    cursor = addMonths(cursor, passo);
  }

  return datas;
}

/**
 * Cria as ocorrências em falta, até `diasAdiante` no futuro.
 *
 * Corre quando alguém abre a app — não precisa de cron. Para uma app de uso
 * pessoal isso chega, e evita uma peça de infraestrutura que pode falhar em
 * silêncio.
 */
export async function gerarOcorrencias(
  workspaceId: string,
  timezone: string,
  diasAdiante = 60,
): Promise<number> {
  const hoje = todayIso(timezone) as IsoDate;
  const ate = addDays(hoje, diasAdiante);
  // Recupera ocorrências passadas que nunca chegaram a ser geradas (app
  // fechada durante semanas), mas sem ir ao infinito.
  const de = addDays(hoje, -90);

  const regras = await prisma.recurringRule.findMany({
    where: { workspaceId, active: true },
  });
  if (regras.length === 0) return 0;

  let criadas = 0;

  for (const regra of regras) {
    const datas = ocorrenciasEntre(regra, de, ate);
    if (datas.length === 0) continue;

    const jaExistem = await prisma.transaction.findMany({
      where: { recurringId: regra.id, date: { in: datas.map(fromIso) } },
      select: { date: true },
    });
    const existentes = new Set(jaExistem.map((t) => toIso(t.date)));

    for (const data of datas) {
      if (existentes.has(data)) continue;

      const valorConta =
        regra.type === "INCOME" ? regra.amountCents : -regra.amountCents;

      try {
        await prisma.transaction.create({
          data: {
            workspaceId,
            date: fromIso(data),
            dueDate: fromIso(data),
            type: regra.type,
            // SCHEDULED: aparece em "o que vem aí", não no saldo.
            status: "SCHEDULED",
            scope: regra.scope,
            description: regra.name,
            notes: regra.notes,
            recurringId: regra.id,
            entries: {
              create: [
                {
                  workspaceId,
                  accountId: regra.accountId,
                  amountCents: valorConta,
                },
                {
                  workspaceId,
                  categoryId: regra.categoryId,
                  amountCents: -valorConta,
                },
              ],
            },
          },
        });
        criadas++;
      } catch (error) {
        // A constraint única é a rede de segurança contra duas gerações ao
        // mesmo tempo. Se bateu, é porque já lá está — e isso não é erro.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          continue;
        }
        throw error;
      }
    }
  }

  return criadas;
}

// ─── Operações sobre as regras ─────────────────────────────────────────────

export async function listRecurring(workspaceId: string) {
  return prisma.recurringRule.findMany({
    where: { workspaceId },
    include: {
      account: { select: { name: true } },
      category: { select: { name: true, color: true } },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
}

export async function createRecurring(session: SessionUser, raw: unknown) {
  const input = recurringInput.parse(raw);

  const [conta, categoria] = await Promise.all([
    prisma.account.count({
      where: {
        id: input.accountId,
        workspaceId: session.workspaceId,
        archived: false,
      },
    }),
    prisma.category.findFirst({
      where: { id: input.categoryId, workspaceId: session.workspaceId },
      select: { type: true },
    }),
  ]);
  if (conta === 0) throw new Error("Conta inválida.");
  if (!categoria || categoria.type !== input.type) {
    throw new Error(
      input.type === "EXPENSE"
        ? "Escolha uma categoria de despesa."
        : "Escolha uma categoria de receita.",
    );
  }

  const regra = await prisma.recurringRule.create({
    data: {
      workspaceId: session.workspaceId,
      name: input.name,
      type: input.type,
      amountCents: input.amountCents,
      scope: input.scope,
      accountId: input.accountId,
      categoryId: input.categoryId,
      frequency: input.frequency,
      dayOfMonth: input.dayOfMonth ?? null,
      weekday: input.weekday ?? null,
      monthOfYear: input.monthOfYear ?? null,
      startDate: fromIso(input.startDate as IsoDate),
      endDate: input.endDate ? fromIso(input.endDate as IsoDate) : null,
      notes: input.notes || null,
    },
  });

  await recordAudit({
    action: "recurring.created",
    workspaceId: session.workspaceId,
    userId: session.userId,
    userEmail: session.email,
    entity: "RecurringRule",
    entityId: regra.id,
    metadata: {
      name: regra.name,
      amountCents: regra.amountCents,
      frequency: regra.frequency,
    },
  });

  await gerarOcorrencias(session.workspaceId, session.timezone);
  return regra;
}

/**
 * Desligar não apaga o histórico: as ocorrências já confirmadas ficam, e as
 * que ainda estavam por pagar desaparecem. Reescrever o passado nunca.
 */
export async function toggleRecurring(session: SessionUser, id: string) {
  const regra = await prisma.recurringRule.findFirst({
    where: { id, workspaceId: session.workspaceId },
  });
  if (!regra) throw new Error("Recorrência não encontrada.");

  await prisma.$transaction(async (tx) => {
    await tx.recurringRule.update({
      where: { id },
      data: { active: !regra.active },
    });
    if (regra.active) {
      await tx.transaction.deleteMany({
        where: { recurringId: id, status: "SCHEDULED" },
      });
    }
  });

  if (!regra.active) {
    await gerarOcorrencias(session.workspaceId, session.timezone);
  }

  await recordAudit({
    action: "recurring.updated",
    workspaceId: session.workspaceId,
    userId: session.userId,
    userEmail: session.email,
    entity: "RecurringRule",
    entityId: id,
    metadata: { name: regra.name, ativa: !regra.active },
  });
}

export async function deleteRecurring(session: SessionUser, id: string) {
  const regra = await prisma.recurringRule.findFirst({
    where: { id, workspaceId: session.workspaceId },
  });
  if (!regra) throw new Error("Recorrência não encontrada.");

  await prisma.$transaction(async (tx) => {
    // As previstas somem; as já pagas ficam, soltas da regra.
    await tx.transaction.deleteMany({
      where: { recurringId: id, status: "SCHEDULED" },
    });
    await tx.recurringRule.delete({ where: { id } });
  });

  await recordAudit({
    action: "recurring.deleted",
    workspaceId: session.workspaceId,
    userId: session.userId,
    userEmail: session.email,
    entity: "RecurringRule",
    entityId: id,
    metadata: { name: regra.name },
  });
}

// ─── Contas a pagar ────────────────────────────────────────────────────────

export type Vencimento = {
  id: string;
  date: IsoDate;
  description: string;
  amountCents: number;
  type: "INCOME" | "EXPENSE";
  categoryName: string | null;
  accountName: string | null;
  diasAteVencer: number;
  atrasada: boolean;
};

export async function listarVencimentos(
  workspaceId: string,
  timezone: string,
  diasAdiante = 30,
): Promise<Vencimento[]> {
  const hoje = todayIso(timezone) as IsoDate;
  const limite = addDays(hoje, diasAdiante);

  const previstas = await prisma.transaction.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      status: "SCHEDULED",
      date: { lte: fromIso(limite) },
    },
    include: {
      entries: {
        include: {
          account: { select: { name: true } },
          category: { select: { name: true } },
        },
      },
    },
    orderBy: { date: "asc" },
  });

  return previstas.map((t) => {
    const linhaConta = t.entries.find((e) => e.accountId);
    const linhaCategoria = t.entries.find((e) => e.categoryId);
    const data = toIso(t.date);
    return {
      id: t.id,
      date: data,
      description: t.description,
      amountCents: Math.abs(linhaConta?.amountCents ?? 0),
      type: t.type === "INCOME" ? "INCOME" : "EXPENSE",
      categoryName: linhaCategoria?.category?.name ?? null,
      accountName: linhaConta?.account?.name ?? null,
      // Negativo = já passou do prazo.
      diasAteVencer: diffDays(hoje, data),
      atrasada: data < hoje,
    };
  });
}

/**
 * Confirma que a conta foi mesmo paga: passa de SCHEDULED a CLEARED e é
 * nesse momento — e só nesse — que o saldo muda.
 */
export async function confirmarPagamento(
  session: SessionUser,
  id: string,
  dataReal?: IsoDate,
) {
  await prisma.$transaction(async (tx) => {
    const t = await tx.transaction.findFirst({
      where: {
        id,
        workspaceId: session.workspaceId,
        status: "SCHEDULED",
        deletedAt: null,
      },
      include: { entries: { select: { accountId: true } } },
    });
    if (!t) throw new Error("Movimento previsto não encontrado.");

    await tx.transaction.update({
      where: { id },
      data: {
        status: "CLEARED",
        ...(dataReal ? { date: fromIso(dataReal) } : {}),
      },
    });

    for (const contaId of new Set(
      t.entries.map((e) => e.accountId).filter(Boolean) as string[],
    )) {
      await recomputeAccountBalance(tx, contaId);
    }

    await recordAudit(
      {
        action: "transaction.updated",
        workspaceId: session.workspaceId,
        userId: session.userId,
        userEmail: session.email,
        entity: "Transaction",
        entityId: id,
        metadata: { confirmadaComoPaga: true, descricao: t.description },
      },
      tx,
    );
  });
}

/** Rejeitar uma ocorrência prevista que não vai acontecer este mês. */
export async function dispensarVencimento(session: SessionUser, id: string) {
  const t = await prisma.transaction.findFirst({
    where: { id, workspaceId: session.workspaceId, status: "SCHEDULED" },
    select: { id: true, description: true },
  });
  if (!t) throw new Error("Movimento previsto não encontrado.");

  await prisma.transaction.update({
    where: { id },
    data: { status: "VOID", deletedAt: new Date() },
  });

  await recordAudit({
    action: "transaction.deleted",
    workspaceId: session.workspaceId,
    userId: session.userId,
    userEmail: session.email,
    entity: "Transaction",
    entityId: id,
    metadata: { dispensada: true, descricao: t.description },
  });
}
