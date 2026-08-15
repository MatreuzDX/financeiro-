/**
 * Configuração inicial guiada.
 *
 * Um dashboard vazio, sem nada onde clicar, é a forma mais rápida de alguém
 * desistir de uma app financeira. Isto faz perguntas e deixa a app já a
 * fazer sentido no primeiro ecrã.
 *
 * SERVE QUALQUER PESSOA, não só quem faz entregas de mota. As perguntas
 * adaptam-se ao perfil: quem só tem ordenado não é interrogado sobre
 * quilómetros; quem vive com a família não é obrigado a inventar uma renda;
 * quem tem três fontes de rendimento pode registá-las todas.
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
import type { Tx } from "@/server/db";
import { recordAudit } from "@/server/audit";
import { fromIso, startOfMonth, todayIso, type IsoDate } from "@/lib/date";
import type { SessionUser } from "@/server/auth/session";

/** Ainda não há nada? É o que decide se o assistente aparece. */
export async function needsSetup(workspaceId: string): Promise<boolean> {
  const contas = await prisma.account.count({ where: { workspaceId } });
  return contas === 0;
}

const cents = z.number().int().min(0).max(2_147_483_647);
const nome = z.string().trim().min(1).max(60);

/** Perfis que mudam as perguntas seguintes. Podem acumular-se. */
export const PERFIS = [
  { id: "EMPREGADO", label: "Trabalho por conta de outrem", hint: "Recebo ordenado" },
  { id: "INDEPENDENTE", label: "Trabalho por conta própria", hint: "Recibos verdes, freelance" },
  { id: "ENTREGAS", label: "Faço entregas ou transporte", hint: "Ao km, à entrega, à hora" },
  { id: "NEGOCIO", label: "Tenho um negócio", hint: "Loja, oficina, serviços" },
  { id: "ESTUDANTE", label: "Estudo", hint: "Bolsa, apoio da família" },
  { id: "REFORMADO", label: "Estou reformado", hint: "Pensão" },
  { id: "SEM_RENDIMENTO", label: "De momento sem rendimento", hint: "Entre empregos, apoios" },
] as const;

export const HABITACAO = [
  { id: "ARRENDO", label: "Arrendo", categoria: "Renda" },
  { id: "CREDITO", label: "Tenho crédito à habitação", categoria: "Prestação da casa" },
  { id: "PAGA", label: "Casa paga", categoria: null },
  { id: "FAMILIA", label: "Vivo com família", categoria: null },
] as const;

export const AGREGADO = [
  { id: "SOZINHO", label: "Sozinho" },
  { id: "CASAL", label: "Em casal" },
  { id: "FILHOS", label: "Com filhos" },
  { id: "PARTILHADA", label: "Casa partilhada" },
] as const;

export const setupInput = z.object({
  perfis: z.array(z.string().max(30)).max(10).default([]),

  conta: z.object({
    name: nome,
    type: z.enum(["BANK", "CASH", "CARD", "SAVINGS", "OTHER"]),
    openingCents: z.number().int().min(-2_147_483_647).max(2_147_483_647),
  }),
  dinheiroVivoCents: cents.nullable().optional(),
  /** Cria uma conta poupança separada, para o dinheiro de lado não se misturar. */
  poupancaCents: cents.nullable().optional(),

  /** Várias fontes: ordenado + freelance + arrendamento, se for o caso. */
  rendimentos: z
    .array(
      z.object({
        name: nome,
        type: z.enum([
          "SALARY",
          "DELIVERY",
          "FREELANCE",
          "BUSINESS",
          "RENTAL",
          "OTHER",
        ]),
        mensalCents: cents.nullable().optional(),
      }),
    )
    .max(10)
    .default([]),

  habitacao: z
    .enum(["ARRENDO", "CREDITO", "PAGA", "FAMILIA"])
    .nullable()
    .optional(),
  habitacaoCents: cents.nullable().optional(),
  agregado: z
    .enum(["SOZINHO", "CASAL", "FILHOS", "PARTILHADA"])
    .nullable()
    .optional(),

  veiculo: z
    .object({
      name: nome,
      brand: z.string().trim().max(40).nullable().optional(),
      model: z.string().trim().max(40).nullable().optional(),
      year: z.number().int().min(1900).max(2100).nullable().optional(),
      type: z.enum(["MOTORCYCLE", "SCOOTER", "CAR", "VAN", "BICYCLE", "OTHER"]),
      fuelType: z.enum(["PETROL", "DIESEL", "ELECTRIC", "HYBRID", "LPG", "NONE"]),
      currentMetres: z.number().int().min(0).max(2_147_483_647),
      combustivelMensalCents: cents.nullable().optional(),
      manutencaoMensalCents: cents.nullable().optional(),
      usaParaTrabalho: z.boolean().default(false),
    })
    .nullable()
    .optional(),

  /** Quem anda de transportes públicos também tem um custo fixo. */
  transportesMensalCents: cents.nullable().optional(),

  /** Créditos, prestações, cartões. Somam numa única linha de orçamento. */
  creditos: z
    .array(z.object({ nome: nome, mensalCents: cents }))
    .max(10)
    .default([]),

  /** Contas fixas: nome da categoria → valor mensal previsto. */
  fixas: z.record(z.string(), cents).default({}),
});

export type SetupInput = z.infer<typeof setupInput>;

/**
 * Perguntas de contas fixas.
 *
 * `perfis` e `agregado` decidem quais aparecem — não faz sentido perguntar
 * a creche a quem não tem filhos, nem material de trabalho a quem é
 * empregado por conta de outrem.
 */
export const FIXED_QUESTIONS: {
  categoria: string;
  pergunta: string;
  exemplo?: string;
  soSe?: { agregado?: string[]; perfis?: string[] };
}[] = [
  { categoria: "Supermercado", pergunta: "Supermercado", exemplo: "por mês" },
  { categoria: "Eletricidade", pergunta: "Eletricidade" },
  { categoria: "Água", pergunta: "Água" },
  { categoria: "Gás", pergunta: "Gás" },
  { categoria: "Internet", pergunta: "Internet" },
  { categoria: "Telefone", pergunta: "Telemóvel" },
  { categoria: "Condomínio", pergunta: "Condomínio" },
  { categoria: "Seguros", pergunta: "Seguros", exemplo: "saúde, vida, casa" },
  { categoria: "Saúde", pergunta: "Saúde", exemplo: "farmácia, consultas" },
  {
    categoria: "Creche e escola",
    pergunta: "Creche ou escola",
    soSe: { agregado: ["FILHOS"] },
  },
  {
    categoria: "Educação",
    pergunta: "Propinas ou formação",
    soSe: { perfis: ["ESTUDANTE"] },
  },
  { categoria: "Animais", pergunta: "Animais", exemplo: "ração, veterinário" },
  { categoria: "Subscrições", pergunta: "Subscrições", exemplo: "streaming, ginásio" },
  { categoria: "Lazer", pergunta: "Lazer" },
];

export type SetupResult = {
  contasCriadas: number;
  fontesCriadas: number;
  veiculoCriado: boolean;
  linhasOrcamento: number;
  totalOrcamentadoCents: number;
  rendimentoMensalCents: number;
};

/**
 * Devolve o id de uma categoria, criando-a se ainda não existir.
 *
 * Antes, uma resposta cuja categoria não estivesse na lista base era
 * silenciosamente DEITADA FORA — a pessoa escrevia um valor, carregava em
 * guardar, e ele não aparecia em lado nenhum.
 */
async function garantirCategoria(
  tx: Tx,
  workspaceId: string,
  name: string,
  type: "INCOME" | "EXPENSE",
): Promise<string> {
  const existente = await tx.category.findFirst({
    where: { workspaceId, name, type },
    select: { id: true },
  });
  if (existente) return existente.id;

  const criada = await tx.category.create({
    data: { workspaceId, name, type, color: "#64748b", isSystem: false },
    select: { id: true },
  });
  return criada.id;
}

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

    const criarConta = async (
      name: string,
      type: "BANK" | "CASH" | "CARD" | "SAVINGS" | "OTHER",
      openingCents: number,
      sortOrder: number,
    ) => {
      const jaHa = await tx.account.findFirst({
        where: { workspaceId, name },
        select: { id: true },
      });
      if (jaHa) return;
      await tx.account.create({
        data: {
          workspaceId,
          name,
          type,
          openingCents,
          cachedBalanceCents: openingCents,
          sortOrder,
        },
      });
      contasCriadas++;
    };

    await criarConta(
      input.conta.name,
      input.conta.type,
      input.conta.openingCents,
      0,
    );

    if (input.dinheiroVivoCents != null && input.dinheiroVivoCents > 0) {
      await criarConta("Dinheiro", "CASH", input.dinheiroVivoCents, 1);
    }

    if (input.poupancaCents != null && input.poupancaCents > 0) {
      await criarConta("Poupança", "SAVINGS", input.poupancaCents, 2);
    }

    // ── Fontes de rendimento ─────────────────────────────────────────────
    let fontesCriadas = 0;
    let rendimentoMensalCents = 0;

    for (const fonte of input.rendimentos) {
      rendimentoMensalCents += fonte.mensalCents ?? 0;
      const jaHa = await tx.incomeSource.findFirst({
        where: { workspaceId, name: fonte.name },
        select: { id: true },
      });
      if (jaHa) continue;
      await tx.incomeSource.create({
        data: {
          workspaceId,
          name: fonte.name,
          type: fonte.type,
          scope: fonte.type === "SALARY" ? "PERSONAL" : "BUSINESS",
        },
      });
      fontesCriadas++;
    }
    // NOTA: os valores mensais NÃO viram receitas lançadas. O ordenado deste
    // mês pode ainda não ter entrado, e lançá-lo punha no saldo dinheiro que
    // ainda não existe. Servem de referência no orçamento.

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
    const somar = (categoria: string, valor?: number | null) => {
      if (!valor || valor <= 0) return;
      previstos.set(categoria, (previstos.get(categoria) ?? 0) + valor);
    };

    for (const [categoria, valor] of Object.entries(input.fixas)) {
      somar(categoria, valor);
    }

    // Habitação: renda e prestação são coisas diferentes e devem aparecer
    // separadas no relatório. Casa paga ou a viver com família não geram
    // linha nenhuma — e é mesmo assim que deve ser.
    const habitacao = HABITACAO.find((h) => h.id === input.habitacao);
    if (habitacao?.categoria) {
      somar(habitacao.categoria, input.habitacaoCents);
    }

    somar("Transportes", input.transportesMensalCents);
    somar("Combustível", input.veiculo?.combustivelMensalCents);
    somar("Manutenção", input.veiculo?.manutencaoMensalCents);

    for (const credito of input.creditos) {
      somar("Créditos e empréstimos", credito.mensalCents);
    }

    let linhasOrcamento = 0;
    let totalOrcamentadoCents = 0;

    if (previstos.size > 0) {
      const budget = await tx.budget.upsert({
        where: { workspaceId_month: { workspaceId, month: fromIso(mes) } },
        create: { workspaceId, month: fromIso(mes) },
        update: {},
      });

      for (const [nomeCategoria, plannedCents] of previstos) {
        const categoryId = await garantirCategoria(
          tx,
          workspaceId,
          nomeCategoria,
          "EXPENSE",
        );
        await tx.budgetLine.upsert({
          where: { budgetId_categoryId: { budgetId: budget.id, categoryId } },
          create: { budgetId: budget.id, categoryId, plannedCents },
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
          perfis: input.perfis,
          habitacao: input.habitacao ?? null,
          agregado: input.agregado ?? null,
          contasCriadas,
          fontesCriadas,
          veiculoCriado,
          linhasOrcamento,
          totalOrcamentadoCents,
          rendimentoMensalCents,
        },
      },
      tx,
    );

    return {
      contasCriadas,
      fontesCriadas,
      veiculoCriado,
      linhasOrcamento,
      totalOrcamentadoCents,
      rendimentoMensalCents,
    };
  });
}
