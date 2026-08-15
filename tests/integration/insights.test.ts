/**
 * Análise: as observações em linguagem simples.
 *
 * O que interessa provar não é a redação — é que nenhuma observação aparece
 * sem dados que a sustentem, e que os números batem certo com o que foi
 * registado. Uma frase confiante sobre um número errado é pior do que
 * frase nenhuma.
 *
 * Precisa de `npm run db:start` a correr.
 */

import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/server/db";
import type { SessionUser } from "@/server/auth/session";
import { analisar } from "@/server/insights";
import { seedDefaultCategories } from "@/server/onboarding";
import { createTransaction } from "@/server/ledger";
import { resolvePeriod } from "@/lib/period";
import { startOfMonth, todayIso } from "@/lib/date";
// Nunca escrever "300,00 €" à mão numa asserção: o formatador usa espaço
// INQUEBRÁVEL antes do símbolo, e a comparação falha por um carácter que
// não se vê. Usa-se a mesma função que a app usa.
import { formatCents } from "@/lib/money";

const criados: string[] = [];

async function novoWorkspace(label: string) {
  const suffix = randomUUID().slice(0, 8);
  const user = await prisma.user.create({
    data: {
      name: `Teste ${label}`,
      email: `insights-${suffix}@exemplo.local`,
      passwordHash: "não-usado",
      role: "OWNER",
    },
  });
  const workspace = await prisma.workspace.create({
    data: {
      name: `Insights ${label}`,
      memberships: { create: { userId: user.id, role: "OWNER" } },
    },
  });
  await seedDefaultCategories(workspace.id);
  criados.push(workspace.id);

  const conta = await prisma.account.create({
    data: {
      workspaceId: workspace.id,
      name: "Conta à ordem",
      type: "BANK",
      openingCents: 0,
      cachedBalanceCents: 0,
    },
  });

  const session: SessionUser = {
    sessionId: `s-${suffix}`,
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
  };

  const categoria = async (name: string, type: "INCOME" | "EXPENSE") =>
    (
      await prisma.category.findFirstOrThrow({
        where: { workspaceId: workspace.id, name, type },
        select: { id: true },
      })
    ).id;

  return { session, contaId: conta.id, categoria };
}

const periodoDoMes = () =>
  resolvePeriod({ periodo: "mes", today: todayIso("Europe/Lisbon") });

afterAll(async () => {
  for (const id of criados) {
    await prisma.workspace.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("análise", () => {
  it("sem movimentos, diz que não há nada em vez de inventar", async () => {
    const { session } = await novoWorkspace("vazio");
    const a = await analisar(session.workspaceId, periodoDoMes(), "Europe/Lisbon");

    expect(a.semDados).toBe(true);
    expect(a.resumo).toContain("Ainda não há movimentos");
    // Nada de percentagens nem projeções tiradas do nada.
    expect(a.resumo).not.toMatch(/\d+%/);
    expect(a.insights).toHaveLength(1);
    expect(a.insights[0].id).toBe("comecar");
  });

  it("calcula a taxa de poupança a partir dos movimentos reais", async () => {
    const { session, contaId, categoria } = await novoWorkspace("poupanca");
    const mes = startOfMonth(todayIso("Europe/Lisbon"));

    await createTransaction(session, {
      type: "INCOME",
      date: mes,
      description: "Ordenado",
      amountCents: 100_000,
      accountId: contaId,
      categoryId: await categoria("Ordenado", "INCOME"),
      scope: "PERSONAL",
    });
    await createTransaction(session, {
      type: "EXPENSE",
      date: mes,
      description: "Renda",
      amountCents: 75_000,
      accountId: contaId,
      categoryId: await categoria("Renda", "EXPENSE"),
      scope: "PERSONAL",
    });

    const a = await analisar(session.workspaceId, periodoDoMes(), "Europe/Lisbon");
    const taxa = a.insights.find((i) => i.id === "taxa-poupanca");

    expect(taxa).toBeDefined();
    // 25 000 de 100 000 = 25 € em cada 100 €.
    expect(taxa!.observacao).toContain("sobraram 25 €");
    expect(taxa!.tom).toBe("bom");
    expect(a.semDados).toBe(false);
  });

  it("avisa quando se gastou mais do que se recebeu", async () => {
    const { session, contaId, categoria } = await novoWorkspace("negativo");
    const mes = startOfMonth(todayIso("Europe/Lisbon"));

    await createTransaction(session, {
      type: "INCOME",
      date: mes,
      description: "Ordenado",
      amountCents: 50_000,
      accountId: contaId,
      categoryId: await categoria("Ordenado", "INCOME"),
      scope: "PERSONAL",
    });
    await createTransaction(session, {
      type: "EXPENSE",
      date: mes,
      description: "Renda",
      amountCents: 80_000,
      accountId: contaId,
      categoryId: await categoria("Renda", "EXPENSE"),
      scope: "PERSONAL",
    });

    const a = await analisar(session.workspaceId, periodoDoMes(), "Europe/Lisbon");
    const taxa = a.insights.find((i) => i.id === "taxa-poupanca");

    expect(taxa!.tom).toBe("mau");
    expect(taxa!.observacao).toContain(formatCents(30_000));
    expect(a.resumo).toContain("Faltaram");
  });

  it("explica que uma transferência não é despesa", async () => {
    const { session, contaId } = await novoWorkspace("transferencia");
    const mes = startOfMonth(todayIso("Europe/Lisbon"));

    const poupanca = await prisma.account.create({
      data: {
        workspaceId: session.workspaceId,
        name: "Poupança",
        type: "SAVINGS",
        openingCents: 0,
        cachedBalanceCents: 0,
      },
    });

    await createTransaction(session, {
      type: "TRANSFER",
      date: mes,
      description: "Para a poupança",
      amountCents: 20_000,
      fromAccountId: contaId,
      toAccountId: poupanca.id,
      scope: "PERSONAL",
    });

    const a = await analisar(session.workspaceId, periodoDoMes(), "Europe/Lisbon");
    const nota = a.insights.find((i) => i.id === "transferencias");

    expect(nota).toBeDefined();
    expect(nota!.porque).toContain("mudar de bolso");
    // E, de facto, não entrou nas despesas: a transferência de 200 € não
    // aparece em lado nenhum do resumo como gasto.
    expect(a.resumo).toContain(`saíram ${formatCents(0)}`);
    expect(a.resumo).not.toContain(formatCents(20_000));
  });

  it("não fala de subidas de categoria sem período anterior para comparar", async () => {
    const { session, contaId, categoria } = await novoWorkspace("sem-base");
    const mes = startOfMonth(todayIso("Europe/Lisbon"));

    await createTransaction(session, {
      type: "EXPENSE",
      date: mes,
      description: "Compras",
      amountCents: 40_000,
      accountId: contaId,
      categoryId: await categoria("Supermercado", "EXPENSE"),
      scope: "PERSONAL",
    });

    const a = await analisar(session.workspaceId, periodoDoMes(), "Europe/Lisbon");
    expect(a.insights.find((i) => i.id === "maior-subida")).toBeUndefined();
  });

  it("toda a observação tem número, explicação e identificador único", async () => {
    const { session, contaId, categoria } = await novoWorkspace("estrutura");
    const mes = startOfMonth(todayIso("Europe/Lisbon"));

    await createTransaction(session, {
      type: "INCOME",
      date: mes,
      description: "Ordenado",
      amountCents: 90_000,
      accountId: contaId,
      categoryId: await categoria("Ordenado", "INCOME"),
      scope: "PERSONAL",
    });
    await createTransaction(session, {
      type: "EXPENSE",
      date: mes,
      description: "Renda",
      amountCents: 45_000,
      accountId: contaId,
      categoryId: await categoria("Renda", "EXPENSE"),
      scope: "PERSONAL",
    });

    const a = await analisar(session.workspaceId, periodoDoMes(), "Europe/Lisbon");
    const ids = a.insights.map((i) => i.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const i of a.insights) {
      expect(i.titulo.length).toBeGreaterThan(3);
      expect(i.observacao.length).toBeGreaterThan(10);
      expect(i.porque.length).toBeGreaterThan(20);
      if (i.acao) expect(i.acao.href.startsWith("/")).toBe(true);
    }
  });
});
