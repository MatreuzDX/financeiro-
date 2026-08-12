/**
 * Testes de integração contra o Postgres real.
 *
 * Mocks provariam que o mock funciona. As garantias que interessam vivem na
 * base de dados: a soma-zero, a auditoria imutável, o isolamento entre
 * workspaces. Com mock, tudo passava e nada ficava provado.
 *
 * Precisa de `npm run db:start` a correr.
 */

import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/server/db";
import type { SessionUser } from "@/server/auth/session";
import {
  createTransaction,
  deleteTransaction,
  LedgerError,
} from "@/server/ledger";
import { getSummary, getTotalBalance } from "@/server/reports";
import { createFirstOwner, hasAnyUser } from "@/server/onboarding";

type Fixture = {
  session: SessionUser;
  workspaceId: string;
  userId: string;
  accountA: string;
  accountB: string;
  expenseCategory: string;
  incomeCategory: string;
};

async function makeFixture(label: string): Promise<Fixture> {
  const suffix = randomUUID().slice(0, 8);

  const user = await prisma.user.create({
    data: {
      name: `Teste ${label}`,
      email: `teste-${suffix}@exemplo.local`,
      passwordHash: "não-usado-nestes-testes",
      role: "OWNER",
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: `Workspace ${label} ${suffix}`,
      memberships: { create: { userId: user.id, role: "OWNER" } },
    },
  });

  const [accountA, accountB, expenseCategory, incomeCategory] =
    await Promise.all([
      prisma.account.create({
        data: {
          workspaceId: workspace.id,
          name: "Conta à ordem",
          type: "BANK",
          openingCents: 100_000,
          cachedBalanceCents: 100_000,
        },
      }),
      prisma.account.create({
        data: {
          workspaceId: workspace.id,
          name: "Poupança",
          type: "SAVINGS",
          openingCents: 0,
          cachedBalanceCents: 0,
        },
      }),
      prisma.category.create({
        data: {
          workspaceId: workspace.id,
          name: "Supermercado",
          type: "EXPENSE",
        },
      }),
      prisma.category.create({
        data: { workspaceId: workspace.id, name: "Ordenado", type: "INCOME" },
      }),
    ]);

  return {
    workspaceId: workspace.id,
    userId: user.id,
    accountA: accountA.id,
    accountB: accountB.id,
    expenseCategory: expenseCategory.id,
    incomeCategory: incomeCategory.id,
    session: {
      sessionId: "sessao-de-teste",
      userId: user.id,
      name: user.name,
      email: user.email,
      role: "OWNER",
      mustChangePassword: false,
      theme: "SYSTEM",
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      currency: "EUR",
      timezone: "Europe/Lisbon",
    },
  };
}

const created: string[] = [];

async function fixture(label: string) {
  const f = await makeFixture(label);
  created.push(f.workspaceId);
  return f;
}

afterAll(async () => {
  // Os dados criados a testar são limpos — não ficam a sujar a base local.
  for (const workspaceId of created) {
    await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
  }
  await prisma.user
    .deleteMany({ where: { email: { endsWith: "@exemplo.local" } } })
    .catch(() => {});
  await prisma.$disconnect();
});

const RANGE = { from: "2026-08-01", to: "2026-08-31" };

describe("saldos", () => {
  it("uma despesa desce o saldo exatamente pelo valor gasto", async () => {
    const f = await fixture("despesa");

    await createTransaction(f.session, {
      type: "EXPENSE",
      date: "2026-08-10",
      description: "Compras",
      amountCents: 6_240,
      accountId: f.accountA,
      categoryId: f.expenseCategory,
      scope: "PERSONAL",
    });

    const account = await prisma.account.findUniqueOrThrow({
      where: { id: f.accountA },
    });
    expect(account.cachedBalanceCents).toBe(100_000 - 6_240);
  });

  it("uma receita sobe o saldo e conta como receita", async () => {
    const f = await fixture("receita");

    await createTransaction(f.session, {
      type: "INCOME",
      date: "2026-08-01",
      description: "Ordenado",
      amountCents: 92_000,
      accountId: f.accountA,
      categoryId: f.incomeCategory,
      scope: "PERSONAL",
    });

    const account = await prisma.account.findUniqueOrThrow({
      where: { id: f.accountA },
    });
    expect(account.cachedBalanceCents).toBe(192_000);

    const summary = await getSummary(f.workspaceId, RANGE);
    expect(summary.incomeCents).toBe(92_000);
    expect(summary.expenseCents).toBe(0);
    expect(summary.netCents).toBe(92_000);
  });
});

describe("transferências", () => {
  it("NÃO contam como receita nem como despesa", async () => {
    // O teste que justifica todo o desenho do livro de lançamentos.
    const f = await fixture("transferencia");

    await createTransaction(f.session, {
      type: "TRANSFER",
      date: "2026-08-05",
      description: "Para a poupança",
      amountCents: 20_000,
      fromAccountId: f.accountA,
      toAccountId: f.accountB,
      scope: "PERSONAL",
    });

    const summary = await getSummary(f.workspaceId, RANGE);
    expect(summary.incomeCents).toBe(0);
    expect(summary.expenseCents).toBe(0);
    expect(summary.netCents).toBe(0);

    // Mas o dinheiro mudou mesmo de sítio.
    const [a, b] = await Promise.all([
      prisma.account.findUniqueOrThrow({ where: { id: f.accountA } }),
      prisma.account.findUniqueOrThrow({ where: { id: f.accountB } }),
    ]);
    expect(a.cachedBalanceCents).toBe(80_000);
    expect(b.cachedBalanceCents).toBe(20_000);

    // E o total não mudou: transferir não cria nem destrói dinheiro.
    expect(await getTotalBalance(f.workspaceId)).toBe(100_000);
  });

  it("recusa transferir de uma conta para ela própria", async () => {
    const f = await fixture("transferencia-mesma");
    await expect(
      createTransaction(f.session, {
        type: "TRANSFER",
        date: "2026-08-05",
        description: "Circular",
        amountCents: 1_000,
        fromAccountId: f.accountA,
        toAccountId: f.accountA,
        scope: "PERSONAL",
      }),
    ).rejects.toThrow();
  });
});

describe("isolamento entre workspaces", () => {
  it("nunca escreve na conta de outra pessoa, mesmo com o id adulterado", async () => {
    const ana = await fixture("ana");
    const beatriz = await fixture("beatriz");

    // A sessão é da Ana; o formulário foi adulterado com a conta da Beatriz.
    await expect(
      createTransaction(ana.session, {
        type: "EXPENSE",
        date: "2026-08-10",
        description: "Adulterado",
        amountCents: 5_000,
        accountId: beatriz.accountA,
        categoryId: ana.expenseCategory,
        scope: "PERSONAL",
      }),
    ).rejects.toBeInstanceOf(LedgerError);

    const account = await prisma.account.findUniqueOrThrow({
      where: { id: beatriz.accountA },
    });
    expect(account.cachedBalanceCents).toBe(100_000);
  });

  it("recusa uma categoria de outro workspace", async () => {
    const ana = await fixture("ana-cat");
    const beatriz = await fixture("beatriz-cat");

    await expect(
      createTransaction(ana.session, {
        type: "EXPENSE",
        date: "2026-08-10",
        description: "Adulterado",
        amountCents: 5_000,
        accountId: ana.accountA,
        categoryId: beatriz.expenseCategory,
        scope: "PERSONAL",
      }),
    ).rejects.toBeInstanceOf(LedgerError);
  });

  it("os totais de uma pessoa não incluem os movimentos da outra", async () => {
    const ana = await fixture("ana-totais");
    const beatriz = await fixture("beatriz-totais");

    await createTransaction(ana.session, {
      type: "EXPENSE",
      date: "2026-08-10",
      description: "Da Ana",
      amountCents: 1_000,
      accountId: ana.accountA,
      categoryId: ana.expenseCategory,
      scope: "PERSONAL",
    });
    await createTransaction(beatriz.session, {
      type: "EXPENSE",
      date: "2026-08-10",
      description: "Da Beatriz",
      amountCents: 7_777,
      accountId: beatriz.accountA,
      categoryId: beatriz.expenseCategory,
      scope: "PERSONAL",
    });

    expect((await getSummary(ana.workspaceId, RANGE)).expenseCents).toBe(1_000);
    expect((await getSummary(beatriz.workspaceId, RANGE)).expenseCents).toBe(
      7_777,
    );
  });
});

describe("categorias com o tipo errado", () => {
  it("recusa lançar uma despesa numa categoria de receita", async () => {
    const f = await fixture("tipo-errado");
    await expect(
      createTransaction(f.session, {
        type: "EXPENSE",
        date: "2026-08-10",
        description: "Errado",
        amountCents: 1_000,
        accountId: f.accountA,
        categoryId: f.incomeCategory,
        scope: "PERSONAL",
      }),
    ).rejects.toBeInstanceOf(LedgerError);
  });
});

describe("apagar", () => {
  it("é soft delete: sai dos totais mas não desaparece da base", async () => {
    const f = await fixture("apagar");

    const { id } = await createTransaction(f.session, {
      type: "EXPENSE",
      date: "2026-08-10",
      description: "A apagar",
      amountCents: 4_000,
      accountId: f.accountA,
      categoryId: f.expenseCategory,
      scope: "PERSONAL",
    });

    await deleteTransaction(f.session, id);

    const summary = await getSummary(f.workspaceId, RANGE);
    expect(summary.expenseCents).toBe(0);

    const account = await prisma.account.findUniqueOrThrow({
      where: { id: f.accountA },
    });
    expect(account.cachedBalanceCents).toBe(100_000);

    // Continua lá, com a marca de apagado.
    const row = await prisma.transaction.findUniqueOrThrow({ where: { id } });
    expect(row.deletedAt).not.toBeNull();
  });
});

describe("instalação inicial", () => {
  it("recusa criar uma segunda conta pela porta da instalação", async () => {
    // A porta só está aberta enquanto não houver ninguém. Como as fixtures
    // já criaram utilizadores, tem de recusar.
    await fixture("instalacao");
    await expect(
      createFirstOwner({
        name: "Intruso",
        email: `intruso-${randomUUID().slice(0, 8)}@exemplo.local`,
        password: "uma-Palavra-Passe-9!",
      }),
    ).rejects.toThrow(/já tem uma conta/i);
  });

  it("sabe dizer que já existe alguém registado", async () => {
    await fixture("ha-alguem");
    expect(await hasAnyUser()).toBe(true);
  });
});

describe("garantias da própria base de dados", () => {
  it("recusa uma transação com linhas que não somam zero", async () => {
    const f = await fixture("desequilibrada");

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.transaction.create({
          data: {
            workspaceId: f.workspaceId,
            date: new Date("2026-08-10T00:00:00.000Z"),
            type: "EXPENSE",
            description: "Desequilibrada",
            entries: {
              create: [
                {
                  workspaceId: f.workspaceId,
                  accountId: f.accountA,
                  amountCents: -5_000,
                },
                {
                  workspaceId: f.workspaceId,
                  categoryId: f.expenseCategory,
                  amountCents: 4_000, // faltam 10,00 €
                },
              ],
            },
          },
        });
      }),
    ).rejects.toThrow();
  });

  it("recusa uma linha que aponta para conta E categoria ao mesmo tempo", async () => {
    const f = await fixture("xor");

    await expect(
      prisma.$transaction(async (tx) => {
        const t = await tx.transaction.create({
          data: {
            workspaceId: f.workspaceId,
            date: new Date("2026-08-10T00:00:00.000Z"),
            type: "EXPENSE",
            description: "Linha inválida",
          },
        });
        await tx.entry.create({
          data: {
            workspaceId: f.workspaceId,
            transactionId: t.id,
            accountId: f.accountA,
            categoryId: f.expenseCategory,
            amountCents: 0,
          },
        });
      }),
    ).rejects.toThrow();
  });

  it("não deixa reescrever nem apagar o registo de auditoria", async () => {
    const f = await fixture("auditoria");

    await createTransaction(f.session, {
      type: "EXPENSE",
      date: "2026-08-10",
      description: "Para auditar",
      amountCents: 1_500,
      accountId: f.accountA,
      categoryId: f.expenseCategory,
      scope: "PERSONAL",
    });

    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { workspaceId: f.workspaceId, action: "transaction.created" },
    });

    await expect(
      prisma.auditLog.update({
        where: { id: entry.id },
        data: { action: "outra.coisa" },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.auditLog.delete({ where: { id: entry.id } }),
    ).rejects.toThrow();
  });

  it("recusa quilometragem impossível", async () => {
    const f = await fixture("km");
    const vehicle = await prisma.vehicle.create({
      data: { workspaceId: f.workspaceId, name: "Mota de teste" },
    });

    await expect(
      prisma.mileageLog.create({
        data: {
          workspaceId: f.workspaceId,
          vehicleId: vehicle.id,
          date: new Date("2026-08-10T00:00:00.000Z"),
          startMetres: 100_000,
          endMetres: 50_000,
          totalMetres: -50_000,
        },
      }),
    ).rejects.toThrow();
  });
});
