/**
 * Configuração inicial guiada.
 *
 * Um dashboard vazio, sem nada onde clicar, é a forma mais rápida de alguém
 * desistir de uma app financeira. Isto faz meia dúzia de perguntas —
 * quanto tens, de onde vem, tens veículo, quais são as contas fixas — e
 * deixa a app já a fazer sentido no primeiro ecrã.
 *
 * REGRA: só se grava o que a pessoa escreveu. Nada aqui inventa consumos,
 * preços de mercado ou valores "típicos". Um número que a pessoa não
 * reconhece é pior do que campo nenhum, porque ela vai tomar decisões com
 * ele. O que se estima (custo por quilómetro, consumo) é calculado dos
 * dados REAIS dela, mais tarde, e vem sempre rotulado como estimativa.
 *
 * Tudo o que isto cria é editável depois nas páginas normais.
 */

import "server-only";
import { z } from "zod";
import { prisma } from "@/server/db";
import { recordAudit } from "@/server/audit";
import { fromIso, startOfMonth, todayIso, type IsoDate } from "@/lib/date";
import type { SessionUser } from "@/server/auth/session";

/** Ainda não há nada? É o que decide se o assistente aparece. */
export async function needsSetup(workspaceId: string): Promise<boolean> {
  const contas = await prisma.account.count({ where: { workspaceId } });
  return contas === 0;
}

const cents = z.number().int().min(0).max(2_147_483_647);

export const setupInput = z.object({
  conta: z.object({
    name: z.string().trim().min(1).max(60),
    type: z.enum(["BANK", "CASH", "CARD", "SAVINGS", "OTHER"]),
    openingCents: z.number().int().min(-2_147_483_647).max(2_147_483_647),
  }),
  dinheiroVivoCents: cents.nullable().optional(),

  rendimento: z
    .object({
      name: z.string().trim().min(1).max(60),
      type: z.enum(["SALARY", "DELIVERY", "FREELANCE", "BUSINESS", "OTHER"]),
      mensalCents: cents.nullable().optional(),
    })
    .nullable()
    .optional(),

  veiculo: z
    .object({
      name: z.string().trim().min(1).max(60),
      brand: z.string().trim().max(40).nullable().optional(),
      model: z.string().trim().max(40).nullable().optional(),
      year: z.number().int().min(1900).max(2100).nullable().optional(),
      type: z.enum(["MOTORCYCLE", "SCOOTER", "CAR", "VAN", "BICYCLE", "OTHER"]),
      fuelType: z.enum(["PETROL", "DIESEL", "ELECTRIC", "HYBRID", "LPG", "NONE"]),
      currentMetres: z.number().int().min(0).max(2_147_483_647),
      /** Estimativa da própria pessoa; vira linha de orçamento, não despesa. */
      combustivelMensalCents: cents.nullable().optional(),
      manutencaoMensalCents: cents.nullable().optional(),
      usaParaTrabalho: z.boolean().default(false),
    })
    .nullable()
    .optional(),

  /** Contas fixas: nome da categoria → valor mensal previsto. */
  fixas: z.record(z.string(), cents).default({}),
});

export type SetupInput = z.infer<typeof setupInput>;

/**
 * As perguntas sobre contas fixas. Cada uma casa com uma categoria base que
 * já existe no workspace — por isso o assistente não cria categorias novas,
 * só lhes põe um valor no orçamento do mês.
 */
export const FIXED_QUESTIONS: {
  categoria: string;
  pergunta: string;
  exemplo?: string;
}[] = [
  { categoria: "Renda", pergunta: "Renda ou prestação da casa" },
  { categoria: "Supermercado", pergunta: "Supermercado", exemplo: "por mês" },
  { categoria: "Eletricidade", pergunta: "Eletricidade" },
  { categoria: "Água", pergunta: "Água" },
  { categoria: "Gás", pergunta: "Gás" },
  { categoria: "Internet", pergunta: "Internet" },
  { categoria: "Telefone", pergunta: "Telemóvel" },
  { categoria: "Transportes", pergunta: "Transportes", exemplo: "passe, portagens" },
  { categoria: "Subscrições", pergunta: "Subscrições", exemplo: "streaming, ginásio" },
  { categoria: "Saúde", pergunta: "Saúde" },
  { categoria: "Lazer", pergunta: "Lazer" },
];

export type SetupResult = {
  contasCriadas: number;
  veiculoCriado: boolean;
  fonteCriada: boolean;
  linhasOrcamento: number;
  totalOrcamentadoCents: number;
};

/**
 * Aplica tudo numa só transação: ou fica tudo, ou não fica nada. Uma
 * configuração feita a meio — conta criada, orçamento não — deixaria a
 * pessoa sem perceber o que correu mal.
 */
export async function applySetup(
  session: SessionUser,
  raw: unknown,
): Promise<SetupResult> {
  const input = setupInput.parse(raw);
  const mes = startOfMonth(todayIso(session.timezone) as IsoDate);

  return prisma.$transaction(async (tx) => {
    const workspaceId = session.workspaceId;

    // ── Contas ───────────────────────────────────────────────────────────
    let contasCriadas = 0;

    const existente = await tx.account.findFirst({
      where: { workspaceId, name: input.conta.name },
      select: { id: true },
    });
    if (!existente) {
      await tx.account.create({
        data: {
          workspaceId,
          name: input.conta.name,
          type: input.conta.type,
          openingCents: input.conta.openingCents,
          cachedBalanceCents: input.conta.openingCents,
          sortOrder: 0,
        },
      });
      contasCriadas++;
    }

    if (input.dinheiroVivoCents != null && input.dinheiroVivoCents > 0) {
      const jaHa = await tx.account.findFirst({
        where: { workspaceId, name: "Dinheiro" },
        select: { id: true },
      });
      if (!jaHa) {
        await tx.account.create({
          data: {
            workspaceId,
            name: "Dinheiro",
            type: "CASH",
            openingCents: input.dinheiroVivoCents,
            cachedBalanceCents: input.dinheiroVivoCents,
            sortOrder: 1,
          },
        });
        contasCriadas++;
      }
    }

    // ── Fonte de rendimento ──────────────────────────────────────────────
    let fonteCriada = false;
    if (input.rendimento) {
      const jaHa = await tx.incomeSource.findFirst({
        where: { workspaceId, name: input.rendimento.name },
        select: { id: true },
      });
      if (!jaHa) {
        await tx.incomeSource.create({
          data: {
            workspaceId,
            name: input.rendimento.name,
            type: input.rendimento.type,
            scope:
              input.rendimento.type === "SALARY" ? "PERSONAL" : "BUSINESS",
          },
        });
        fonteCriada = true;
      }
      // NOTA: o valor mensal NÃO vira uma receita lançada. O ordenado deste
      // mês pode ainda não ter entrado, e lançá-lo agora punha dinheiro no
      // saldo que ainda não existe. Serve só de referência no orçamento.
    }

    // ── Veículo ──────────────────────────────────────────────────────────
    let veiculoCriado = false;
    if (input.veiculo) {
      const jaHa = await tx.vehicle.findFirst({
        where: { workspaceId, name: input.veiculo.name },
        select: { id: true },
      });
      if (!jaHa) {
        await tx.vehicle.create({
          data: {
            workspaceId,
            name: input.veiculo.name,
            brand: input.veiculo.brand || null,
            model: input.veiculo.model || null,
            year: input.veiculo.year ?? null,
            type: input.veiculo.type,
            fuelType: input.veiculo.fuelType,
            currentMetres: input.veiculo.currentMetres,
          },
        });
        veiculoCriado = true;
      }
    }

    // ── Orçamento do mês ─────────────────────────────────────────────────
    const previstos = new Map<string, number>();
    for (const [categoria, valor] of Object.entries(input.fixas)) {
      if (valor > 0) previstos.set(categoria, valor);
    }
    if (input.veiculo?.combustivelMensalCents) {
      previstos.set("Combustível", input.veiculo.combustivelMensalCents);
    }
    if (input.veiculo?.manutencaoMensalCents) {
      previstos.set("Manutenção", input.veiculo.manutencaoMensalCents);
    }

    let linhasOrcamento = 0;
    let totalOrcamentadoCents = 0;

    if (previstos.size > 0) {
      const categorias = await tx.category.findMany({
        where: {
          workspaceId,
          type: "EXPENSE",
          name: { in: [...previstos.keys()] },
        },
        select: { id: true, name: true },
      });

      const budget = await tx.budget.upsert({
        where: { workspaceId_month: { workspaceId, month: fromIso(mes) } },
        create: { workspaceId, month: fromIso(mes) },
        update: {},
      });

      for (const categoria of categorias) {
        const plannedCents = previstos.get(categoria.name);
        if (!plannedCents) continue;
        await tx.budgetLine.upsert({
          where: {
            budgetId_categoryId: {
              budgetId: budget.id,
              categoryId: categoria.id,
            },
          },
          create: { budgetId: budget.id, categoryId: categoria.id, plannedCents },
          update: { plannedCents },
        });
        linhasOrcamento++;
        totalOrcamentadoCents += plannedCents;
      }
    }

    await recordAudit(
      {
        action: "setup.completed",
        workspaceId,
        userId: session.userId,
        userEmail: session.email,
        metadata: {
          contasCriadas,
          fonteCriada,
          veiculoCriado,
          linhasOrcamento,
          totalOrcamentadoCents,
        },
      },
      tx,
    );

    return {
      contasCriadas,
      veiculoCriado,
      fonteCriada,
      linhasOrcamento,
      totalOrcamentadoCents,
    };
  });
}
