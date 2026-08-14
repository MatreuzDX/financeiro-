/**
 * Configuração inicial guiada, contra o Postgres real.
 *
 * O que interessa provar aqui não é que os campos aparecem no ecrã — é que
 * as respostas viram os dados certos: conta com o saldo indicado, veículo
 * com os quilómetros, e orçamento do mês nas categorias que a pessoa
 * preencheu. E, sobretudo, que NADA é inventado.
 *
 * Precisa de `npm run db:start` a correr.
 */

import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/server/db";
import type { SessionUser } from "@/server/auth/session";
import { applySetup, needsSetup } from "@/server/setup";
import { seedDefaultCategories } from "@/server/onboarding";
import { startOfMonth, todayIso, fromIso } from "@/lib/date";

const criados: string[] = [];

async function novoWorkspace(label: string): Promise<SessionUser> {
  const suffix = randomUUID().slice(0, 8);

  const user = await prisma.user.create({
    data: {
      name: `Teste ${label}`,
      email: `setup-${suffix}@exemplo.local`,
      passwordHash: "não-usado-nestes-testes",
      role: "OWNER",
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: `Setup ${label} ${suffix}`,
      memberships: { create: { userId: user.id, role: "OWNER" } },
    },
  });

  await seedDefaultCategories(workspace.id);
  criados.push(workspace.id);

  return {
    sessionId: `sessao-${suffix}`,
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
}

afterAll(async () => {
  for (const workspaceId of criados) {
    await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("configuração inicial", () => {
  it("um workspace sem contas precisa de configuração", async () => {
    const s = await novoWorkspace("vazio");
    expect(await needsSetup(s.workspaceId)).toBe(true);
  });

  it("cria conta, veículo e orçamento a partir das respostas", async () => {
    const s = await novoWorkspace("completo");

    const resultado = await applySetup(s, {
      conta: { name: "Conta à ordem", type: "BANK", openingCents: 45_000 },
      dinheiroVivoCents: 6_000,
      rendimento: {
        name: "Trabalho principal",
        type: "SALARY",
        mensalCents: 92_000,
      },
      veiculo: {
        name: "Honda PCX",
        brand: "Honda",
        model: "PCX 125",
        year: 2016,
        type: "SCOOTER",
        fuelType: "PETROL",
        currentMetres: 24_150_000,
        combustivelMensalCents: 8_000,
        manutencaoMensalCents: 2_500,
        usaParaTrabalho: true,
      },
      fixas: { Renda: 50_000, Internet: 3_500, Eletricidade: 4_180 },
    });

    expect(resultado.contasCriadas).toBe(2);
    expect(resultado.veiculoCriado).toBe(true);
    expect(resultado.fonteCriada).toBe(true);

    const contas = await prisma.account.findMany({
      where: { workspaceId: s.workspaceId },
      orderBy: { sortOrder: "asc" },
    });
    expect(contas.map((c) => [c.name, c.openingCents, c.cachedBalanceCents])).toEqual([
      ["Conta à ordem", 45_000, 45_000],
      ["Dinheiro", 6_000, 6_000],
    ]);

    const veiculo = await prisma.vehicle.findFirstOrThrow({
      where: { workspaceId: s.workspaceId },
    });
    expect(veiculo.name).toBe("Honda PCX");
    expect(veiculo.currentMetres).toBe(24_150_000);
    expect(veiculo.year).toBe(2016);

    // Renda + Internet + Eletricidade + Combustível + Manutenção
    expect(resultado.linhasOrcamento).toBe(5);
    expect(resultado.totalOrcamentadoCents).toBe(
      50_000 + 3_500 + 4_180 + 8_000 + 2_500,
    );

    const mes = startOfMonth(todayIso("Europe/Lisbon"));
    const budget = await prisma.budget.findFirstOrThrow({
      where: { workspaceId: s.workspaceId, month: fromIso(mes) },
      include: { lines: { include: { category: true } } },
    });
    const porNome = Object.fromEntries(
      budget.lines.map((l) => [l.category.name, l.plannedCents]),
    );
    expect(porNome["Renda"]).toBe(50_000);
    expect(porNome["Combustível"]).toBe(8_000);
    expect(porNome["Manutenção"]).toBe(2_500);

    // Deixa de precisar de configuração.
    expect(await needsSetup(s.workspaceId)).toBe(false);
  });

  it("NÃO lança o ordenado como receita — o dinheiro só entra quando entra", async () => {
    const s = await novoWorkspace("sem-receita");

    await applySetup(s, {
      conta: { name: "Conta à ordem", type: "BANK", openingCents: 10_000 },
      rendimento: {
        name: "Trabalho principal",
        type: "SALARY",
        mensalCents: 92_000,
      },
      fixas: {},
    });

    // Existe a fonte de rendimento…
    const fontes = await prisma.incomeSource.count({
      where: { workspaceId: s.workspaceId },
    });
    expect(fontes).toBe(1);

    // …mas nenhum movimento foi lançado, e o saldo é só o que foi indicado.
    const movimentos = await prisma.transaction.count({
      where: { workspaceId: s.workspaceId },
    });
    expect(movimentos).toBe(0);

    const conta = await prisma.account.findFirstOrThrow({
      where: { workspaceId: s.workspaceId },
    });
    expect(conta.cachedBalanceCents).toBe(10_000);
  });

  it("responder só ao primeiro passo é suficiente", async () => {
    const s = await novoWorkspace("minimo");

    const resultado = await applySetup(s, {
      conta: { name: "Carteira", type: "CASH", openingCents: 2_500 },
      rendimento: null,
      veiculo: null,
      fixas: {},
    });

    expect(resultado.contasCriadas).toBe(1);
    expect(resultado.veiculoCriado).toBe(false);
    expect(resultado.linhasOrcamento).toBe(0);
    expect(await needsSetup(s.workspaceId)).toBe(false);
  });

  it("correr duas vezes não duplica nada", async () => {
    const s = await novoWorkspace("repetido");
    const entrada = {
      conta: { name: "Conta à ordem", type: "BANK" as const, openingCents: 30_000 },
      veiculo: {
        name: "Honda PCX",
        type: "SCOOTER" as const,
        fuelType: "PETROL" as const,
        currentMetres: 1_000,
        combustivelMensalCents: 8_000,
      },
      fixas: { Renda: 50_000 },
    };

    await applySetup(s, entrada);
    const segunda = await applySetup(s, entrada);

    expect(segunda.contasCriadas).toBe(0);
    expect(segunda.veiculoCriado).toBe(false);

    expect(
      await prisma.account.count({ where: { workspaceId: s.workspaceId } }),
    ).toBe(1);
    expect(
      await prisma.vehicle.count({ where: { workspaceId: s.workspaceId } }),
    ).toBe(1);
    expect(
      await prisma.budgetLine.count({
        where: { budget: { workspaceId: s.workspaceId } },
      }),
    ).toBe(2); // Renda + Combustível, sem duplicados
  });

  it("recusa valores negativos numa conta fixa", async () => {
    const s = await novoWorkspace("invalido");
    await expect(
      applySetup(s, {
        conta: { name: "Conta", type: "BANK", openingCents: 0 },
        fixas: { Renda: -500 },
      }),
    ).rejects.toThrow();
  });
});
