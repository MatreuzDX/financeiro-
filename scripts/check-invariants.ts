/**
 * Verificação dos invariantes financeiros.
 *
 *   npm run check:invariants
 *
 * Corre no CI e deve correr periodicamente contra produção. Se algum destes
 * falhar, há dinheiro errado no ecrã de alguém — e é melhor sabê-lo por um
 * script do que por um utilizador.
 *
 * Sai com código 1 se encontrar problemas, para o CI travar.
 */

import "dotenv/config";
import { prisma } from "../src/server/db";
import { formatCents } from "../src/lib/money";

type Problem = { check: string; detail: string };

async function main() {
  const problems: Problem[] = [];

  // 1. Toda a transação tem linhas que somam zero.
  const unbalanced = await prisma.$queryRaw<
    { transactionId: string; total: bigint; lines: bigint }[]
  >`
    SELECT "transactionId", SUM("amountCents")::bigint AS total,
           COUNT(*)::bigint AS lines
      FROM "Entry"
     GROUP BY "transactionId"
    HAVING SUM("amountCents") <> 0 OR COUNT(*) < 2
  `;
  for (const row of unbalanced) {
    problems.push({
      check: "soma-zero",
      detail: `Transação ${row.transactionId}: ${row.lines} linha(s), soma ${row.total} cêntimos`,
    });
  }

  // 2. Cada linha aponta para uma conta OU uma categoria, nunca ambas.
  const badEntries = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Entry"
     WHERE ("accountId" IS NULL AND "categoryId" IS NULL)
        OR ("accountId" IS NOT NULL AND "categoryId" IS NOT NULL)
  `;
  for (const row of badEntries) {
    problems.push({
      check: "conta-xor-categoria",
      detail: `Linha ${row.id} aponta para ambos ou para nenhum`,
    });
  }

  // 3. O saldo em cache é igual ao saldo calculado a partir dos lançamentos.
  const accounts = await prisma.account.findMany({
    select: {
      id: true,
      name: true,
      openingCents: true,
      cachedBalanceCents: true,
    },
  });
  for (const account of accounts) {
    const agg = await prisma.entry.aggregate({
      _sum: { amountCents: true },
      where: {
        accountId: account.id,
        transaction: { deletedAt: null, status: "CLEARED" },
      },
    });
    const real = account.openingCents + (agg._sum.amountCents ?? 0);
    if (real !== account.cachedBalanceCents) {
      problems.push({
        check: "saldo-em-cache",
        detail:
          `Conta "${account.name}": cache ${formatCents(account.cachedBalanceCents)}, ` +
          `real ${formatCents(real)}`,
      });
    }
  }

  // 4. Quilometragem coerente.
  const badMileage = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "MileageLog"
     WHERE "totalMetres" <> "endMetres" - "startMetres"
        OR "endMetres" < "startMetres"
  `;
  for (const row of badMileage) {
    problems.push({
      check: "quilometragem",
      detail: `Registo ${row.id} tem quilómetros impossíveis`,
    });
  }

  // 5. Trabalhos cuja receita guardada não bate com o cálculo do servidor.
  const jobs = await prisma.workJob.findMany();
  for (const job of jobs) {
    let base = 0;
    if (job.payModel === "PER_KM") {
      base = Math.round((job.distanceMetres * job.ratePerKmCents) / 1000);
    } else if (job.payModel === "PER_DELIVERY") {
      base = job.deliveries * job.ratePerDeliveryCents;
    } else if (job.payModel === "HOURLY") {
      base = Math.round((job.hoursTenths * job.ratePerHourCents) / 10);
    } else {
      base = job.fixedCents;
    }
    const expected = base + job.tipsCents;
    if (expected !== job.grossCents) {
      problems.push({
        check: "receita-do-trabalho",
        detail:
          `Trabalho ${job.id} (${job.clientName}): guardado ${formatCents(job.grossCents)}, ` +
          `calculado ${formatCents(expected)}`,
      });
    }
  }

  const [transactions, entries, accountCount] = await Promise.all([
    prisma.transaction.count(),
    prisma.entry.count(),
    prisma.account.count(),
  ]);

  console.log(
    `Verificados: ${transactions} movimentos, ${entries} lançamentos, ${accountCount} contas.`,
  );

  if (problems.length === 0) {
    console.log("Todos os invariantes verdes.");
    return;
  }

  console.error(`\n${problems.length} problema(s):`);
  for (const p of problems) {
    console.error(`  [${p.check}] ${p.detail}`);
  }
  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("Falhou:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
