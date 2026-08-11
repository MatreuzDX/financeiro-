/**
 * Dados de demonstração para desenvolvimento.
 *
 *   npm run db:seed
 *
 * IMPORTANTE: nada aqui é um valor fixo do sistema. É um exemplo realista
 * (o cenário do plano: ordenado de €920 + entregas com uma Honda PCX) para
 * que os ecrãs tenham o que mostrar enquanto se constrói. Tudo é editável
 * pela pessoa e nada disto aparece numa instalação de produção.
 *
 * Recusa correr em produção.
 */

import "dotenv/config";
import { prisma } from "../src/server/db";
import { createUserWithWorkspace } from "../src/server/onboarding";
import { generateStrongPassword } from "../src/server/auth/password";
import { computeGrossCents } from "../src/server/work";
import {
  addDays,
  fromIso,
  minIso,
  startOfMonth,
  todayIso,
} from "../src/lib/date";
import { fuelTotalCents } from "../src/lib/money";

if (process.env.NODE_ENV === "production") {
  console.error("O seed não corre em produção.");
  process.exit(1);
}

const SEED_EMAIL = "demo@financeiro.local";

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: SEED_EMAIL } });
  if (existing) {
    console.log(
      `A conta de demonstração ${SEED_EMAIL} já existe. Nada a fazer.\n` +
        `Para recomeçar: npm run db:reset && npm run db:start && npm run db:migrate`,
    );
    return;
  }

  const password = generateStrongPassword();
  const user = await createUserWithWorkspace({
    name: "Demonstração",
    email: SEED_EMAIL,
    password,
    role: "OWNER",
    workspaceName: "Finanças (demonstração)",
  });
  const workspaceId = user.workspaceId;

  // ─── Contas ──────────────────────────────────────────────────────────────
  const [banco, dinheiro] = await Promise.all([
    prisma.account.create({
      data: {
        workspaceId,
        name: "Conta à ordem",
        type: "BANK",
        institution: "Banco",
        openingCents: 45_000,
        cachedBalanceCents: 45_000,
        sortOrder: 0,
      },
    }),
    prisma.account.create({
      data: {
        workspaceId,
        name: "Dinheiro",
        type: "CASH",
        openingCents: 6_000,
        cachedBalanceCents: 6_000,
        sortOrder: 1,
      },
    }),
  ]);

  // ─── Fontes de rendimento ────────────────────────────────────────────────
  const [ordenado, entregas] = await Promise.all([
    prisma.incomeSource.create({
      data: {
        workspaceId,
        name: "Trabalho principal",
        type: "SALARY",
        scope: "PERSONAL",
        color: "#22c55e",
      },
    }),
    prisma.incomeSource.create({
      data: {
        workspaceId,
        name: "Entregas",
        type: "DELIVERY",
        scope: "BUSINESS",
        color: "#10b981",
      },
    }),
  ]);

  // ─── Veículo ─────────────────────────────────────────────────────────────
  const pcx = await prisma.vehicle.create({
    data: {
      workspaceId,
      name: "Honda PCX",
      brand: "Honda",
      model: "PCX 125",
      year: 2016,
      type: "SCOOTER",
      fuelType: "PETROL",
      currentMetres: 24_150_000, // 24 150 km
    },
  });

  const categories = await prisma.category.findMany({ where: { workspaceId } });
  const cat = (name: string) => {
    const found = categories.find((c) => c.name === name);
    if (!found) throw new Error(`Categoria "${name}" não encontrada no seed`);
    return found.id;
  };

  const today = todayIso();
  const monthStart = startOfMonth(today);

  /**
   * Um movimento de demonstração nunca pode ficar datado no futuro: o
   * dashboard mostrava "Pizzaria do Bairro — Amanhã", como se o dinheiro já
   * tivesse entrado de um trabalho por fazer. Datas a partir do início do
   * mês, mas nunca depois de hoje.
   */
  const day = (offset: number) => minIso(addDays(monthStart, offset), today);

  // ─── Movimentos ──────────────────────────────────────────────────────────
  type Simple = {
    date: string;
    description: string;
    cents: number;
    category: string;
    account: string;
    type: "INCOME" | "EXPENSE";
    scope?: "PERSONAL" | "BUSINESS";
    sourceId?: string;
    vehicleId?: string;
  };

  const movements: Simple[] = [
    {
      date: monthStart,
      description: "Ordenado",
      cents: 92_000,
      category: "Ordenado",
      account: banco.id,
      type: "INCOME",
      sourceId: ordenado.id,
    },
    {
      date: day(1),
      description: "Renda",
      cents: 50_000,
      category: "Renda",
      account: banco.id,
      type: "EXPENSE",
    },
    {
      date: day(2),
      description: "Compras da semana",
      cents: 6_240,
      category: "Supermercado",
      account: banco.id,
      type: "EXPENSE",
    },
    {
      date: day(4),
      description: "Eletricidade",
      cents: 4_180,
      category: "Eletricidade",
      account: banco.id,
      type: "EXPENSE",
    },
    {
      date: day(5),
      description: "Internet e telefone",
      cents: 3_500,
      category: "Internet",
      account: banco.id,
      type: "EXPENSE",
    },
    {
      date: day(7),
      description: "Almoço fora",
      cents: 1_150,
      category: "Alimentação",
      account: dinheiro.id,
      type: "EXPENSE",
    },
    {
      date: day(9),
      description: "Revisão da mota",
      cents: 4_500,
      category: "Manutenção",
      account: banco.id,
      type: "EXPENSE",
      scope: "BUSINESS",
      vehicleId: pcx.id,
    },
    {
      date: day(12),
      description: "Compras da semana",
      cents: 5_890,
      category: "Supermercado",
      account: banco.id,
      type: "EXPENSE",
    },
  ];

  for (const m of movements) {
    const accountAmount = m.type === "INCOME" ? m.cents : -m.cents;
    await prisma.transaction.create({
      data: {
        workspaceId,
        date: fromIso(m.date),
        type: m.type,
        scope: m.scope ?? "PERSONAL",
        description: m.description,
        incomeSourceId: m.sourceId ?? null,
        vehicleId: m.vehicleId ?? null,
        entries: {
          create: [
            { workspaceId, accountId: m.account, amountCents: accountAmount },
            {
              workspaceId,
              categoryId: cat(m.category),
              amountCents: -accountAmount,
            },
          ],
        },
      },
    });
  }

  // ─── Abastecimentos ──────────────────────────────────────────────────────
  const fuelRuns = [
    { date: day(3), odo: 24_050_000, ml: 6_500, priceE4: 16_890 },
    { date: day(10), odo: 24_100_000, ml: 6_200, priceE4: 17_150 },
  ];
  for (const f of fuelRuns) {
    const totalCents = fuelTotalCents(f.ml, f.priceE4);
    await prisma.fuelLog.create({
      data: {
        workspaceId,
        vehicleId: pcx.id,
        date: fromIso(f.date),
        odometerMetres: f.odo,
        litersMl: f.ml,
        pricePerLiterE4: f.priceE4,
        totalCents,
        fullTank: true,
      },
    });
    await prisma.transaction.create({
      data: {
        workspaceId,
        date: fromIso(f.date),
        type: "EXPENSE",
        scope: "BUSINESS",
        description: "Combustível — Honda PCX",
        vehicleId: pcx.id,
        entries: {
          create: [
            { workspaceId, accountId: banco.id, amountCents: -totalCents },
            { workspaceId, categoryId: cat("Combustível"), amountCents: totalCents },
          ],
        },
      },
    });
  }

  // ─── Trabalhos de entrega ────────────────────────────────────────────────
  // O exemplo do plano: 150 km a €0,40/km = €60,00 exatos.
  const jobs = [
    { date: day(3), km: 150, start: 23_900_000 },
    { date: day(8), km: 120, start: 24_050_000 },
    { date: day(11), km: 96, start: 24_100_000 },
  ];

  for (const j of jobs) {
    const distanceMetres = j.km * 1000;
    const grossCents = computeGrossCents({
      payModel: "PER_KM",
      distanceMetres,
      ratePerKmCents: 40,
      deliveries: 0,
      ratePerDeliveryCents: 0,
      hoursTenths: 0,
      ratePerHourCents: 0,
      fixedCents: 0,
      tipsCents: 0,
    });

    const job = await prisma.workJob.create({
      data: {
        workspaceId,
        incomeSourceId: entregas.id,
        vehicleId: pcx.id,
        clientName: "Pizzaria do Bairro",
        date: fromIso(j.date),
        payModel: "PER_KM",
        distanceMetres,
        ratePerKmCents: 40,
        grossCents,
      },
    });

    await prisma.mileageLog.create({
      data: {
        workspaceId,
        vehicleId: pcx.id,
        workJobId: job.id,
        date: fromIso(j.date),
        startMetres: j.start,
        endMetres: j.start + distanceMetres,
        totalMetres: distanceMetres,
        purpose: "WORK",
      },
    });

    await prisma.transaction.create({
      data: {
        workspaceId,
        date: fromIso(j.date),
        type: "INCOME",
        scope: "BUSINESS",
        description: "Pizzaria do Bairro",
        incomeSourceId: entregas.id,
        vehicleId: pcx.id,
        workJobId: job.id,
        entries: {
          create: [
            { workspaceId, accountId: banco.id, amountCents: grossCents },
            { workspaceId, categoryId: cat("Entregas"), amountCents: -grossCents },
          ],
        },
      },
    });
  }

  // ─── Orçamento do mês ────────────────────────────────────────────────────
  const budget = await prisma.budget.create({
    data: { workspaceId, month: fromIso(monthStart) },
  });
  await prisma.budgetLine.createMany({
    data: [
      { budgetId: budget.id, categoryId: cat("Alimentação"), plannedCents: 10_000 },
      { budgetId: budget.id, categoryId: cat("Supermercado"), plannedCents: 15_000 },
      { budgetId: budget.id, categoryId: cat("Renda"), plannedCents: 50_000 },
      { budgetId: budget.id, categoryId: cat("Eletricidade"), plannedCents: 5_000 },
      { budgetId: budget.id, categoryId: cat("Internet"), plannedCents: 4_000 },
      { budgetId: budget.id, categoryId: cat("Combustível"), plannedCents: 8_000 },
      { budgetId: budget.id, categoryId: cat("Lazer"), plannedCents: 10_000 },
    ],
  });

  // ─── Recalcular saldos a partir dos lançamentos ──────────────────────────
  for (const accountId of [banco.id, dinheiro.id]) {
    const account = await prisma.account.findUniqueOrThrow({
      where: { id: accountId },
      select: { openingCents: true },
    });
    const agg = await prisma.entry.aggregate({
      _sum: { amountCents: true },
      where: {
        accountId,
        transaction: { deletedAt: null, status: "CLEARED" },
      },
    });
    await prisma.account.update({
      where: { id: accountId },
      data: {
        cachedBalanceCents:
          account.openingCents + (agg._sum.amountCents ?? 0),
      },
    });
  }

  const line = "─".repeat(56);
  console.log(`\n${line}`);
  console.log("  Dados de demonstração criados");
  console.log(line);
  console.log(`  Email:          ${SEED_EMAIL}`);
  console.log(`  Palavra-passe:  ${password}`);
  console.log(line);
  console.log("  Só para desenvolvimento. Mostrada uma única vez.");
  console.log(`${line}\n`);
}

main()
  .catch((error) => {
    console.error("Seed falhou:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
