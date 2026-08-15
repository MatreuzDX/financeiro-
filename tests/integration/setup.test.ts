/**
 * Configuração inicial guiada, contra o Postgres real.
 *
 * O que interessa provar aqui não é que os campos aparecem no ecrã — é que
 * as respostas viram os dados certos, e que o assistente serve vidas
 * diferentes: quem tem ordenado, quem tem três fontes, quem vive com a
 * família e não paga renda, quem anda de autocarro.
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

async function linhasDoOrcamento(workspaceId: string) {
  const mes = startOfMonth(todayIso("Europe/Lisbon"));
  const budget = await prisma.budget.findFirst({
    where: { workspaceId, month: fromIso(mes) },
    include: { lines: { include: { category: true } } },
  });
  return Object.fromEntries(
    (budget?.lines ?? []).map((l) => [l.category.name, l.plannedCents]),
  );
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

  it("entregador: veículo, custos e orçamento", async () => {
    const s = await novoWorkspace("entregador");

    const resultado = await applySetup(s, {
      perfis: ["EMPREGADO", "ENTREGAS"],
      conta: { name: "Conta à ordem", type: "BANK", openingCents: 45_000 },
      dinheiroVivoCents: 6_000,
      poupancaCents: 100_000,
      rendimentos: [
        { name: "Trabalho principal", type: "SALARY", mensalCents: 92_000 },
        { name: "Entregas", type: "DELIVERY", mensalCents: 30_000 },
      ],
      habitacao: "ARRENDO",
      habitacaoCents: 50_000,
      agregado: "SOZINHO",
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
      creditos: [{ nome: "Crédito da mota", mensalCents: 12_000 }],
      fixas: { Internet: 3_500, Eletricidade: 4_180 },
    });

    expect(resultado.contasCriadas).toBe(3); // ordem + dinheiro + poupança
    expect(resultado.fontesCriadas).toBe(2);
    expect(resultado.veiculoCriado).toBe(true);
    expect(resultado.rendimentoMensalCents).toBe(122_000);

    const contas = await prisma.account.findMany({
      where: { workspaceId: s.workspaceId },
      orderBy: { sortOrder: "asc" },
      select: { name: true, type: true, cachedBalanceCents: true },
    });
    expect(contas).toEqual([
      { name: "Conta à ordem", type: "BANK", cachedBalanceCents: 45_000 },
      { name: "Dinheiro", type: "CASH", cachedBalanceCents: 6_000 },
      { name: "Poupança", type: "SAVINGS", cachedBalanceCents: 100_000 },
    ]);

    const orcamento = await linhasDoOrcamento(s.workspaceId);
    expect(orcamento["Renda"]).toBe(50_000);
    expect(orcamento["Combustível"]).toBe(8_000);
    expect(orcamento["Manutenção"]).toBe(2_500);
    expect(orcamento["Créditos e empréstimos"]).toBe(12_000);
    expect(orcamento["Internet"]).toBe(3_500);
    expect(orcamento["Prestação da casa"]).toBeUndefined();
  });

  it("quem vive com família não fica com linha de habitação", async () => {
    const s = await novoWorkspace("familia");

    await applySetup(s, {
      perfis: ["ESTUDANTE"],
      conta: { name: "Conta", type: "BANK", openingCents: 20_000 },
      rendimentos: [
        { name: "Bolsa", type: "OTHER", mensalCents: 25_000 },
      ],
      habitacao: "FAMILIA",
      // Mesmo que venha um valor, não há categoria onde o pôr — e não se
      // inventa uma renda a quem não paga renda.
      habitacaoCents: 40_000,
      agregado: "FILHOS",
      transportesMensalCents: 4_000,
      fixas: { Telefone: 1_500 },
    });

    const orcamento = await linhasDoOrcamento(s.workspaceId);
    expect(orcamento["Renda"]).toBeUndefined();
    expect(orcamento["Prestação da casa"]).toBeUndefined();
    expect(orcamento["Transportes"]).toBe(4_000);
    expect(orcamento["Telefone"]).toBe(1_500);
  });

  it("crédito à habitação vai para a categoria certa, não para Renda", async () => {
    const s = await novoWorkspace("credito-casa");

    await applySetup(s, {
      conta: { name: "Conta", type: "BANK", openingCents: 0 },
      habitacao: "CREDITO",
      habitacaoCents: 62_000,
      fixas: {},
    });

    const orcamento = await linhasDoOrcamento(s.workspaceId);
    expect(orcamento["Prestação da casa"]).toBe(62_000);
    expect(orcamento["Renda"]).toBeUndefined();
  });

  it("vários créditos somam numa só linha", async () => {
    const s = await novoWorkspace("creditos");

    await applySetup(s, {
      conta: { name: "Conta", type: "BANK", openingCents: 0 },
      creditos: [
        { nome: "Cartão", mensalCents: 5_000 },
        { nome: "Carro", mensalCents: 18_000 },
        { nome: "Pessoal", mensalCents: 7_500 },
      ],
      fixas: {},
    });

    const orcamento = await linhasDoOrcamento(s.workspaceId);
    expect(orcamento["Créditos e empréstimos"]).toBe(30_500);
  });

  it("cria a categoria em falta em vez de deitar a resposta fora", async () => {
    const s = await novoWorkspace("categoria-nova");

    await prisma.category.deleteMany({
      where: { workspaceId: s.workspaceId, name: "Animais" },
    });

    await applySetup(s, {
      conta: { name: "Conta", type: "BANK", openingCents: 0 },
      fixas: { Animais: 4_500 },
    });

    const orcamento = await linhasDoOrcamento(s.workspaceId);
    expect(orcamento["Animais"]).toBe(4_500);
  });

  it("NÃO lança os rendimentos como receita — o dinheiro só entra quando entra", async () => {
    const s = await novoWorkspace("sem-receita");

    await applySetup(s, {
      conta: { name: "Conta à ordem", type: "BANK", openingCents: 10_000 },
      rendimentos: [
        { name: "Trabalho principal", type: "SALARY", mensalCents: 92_000 },
      ],
      fixas: {},
    });

    expect(
      await prisma.incomeSource.count({ where: { workspaceId: s.workspaceId } }),
    ).toBe(1);
    expect(
      await prisma.transaction.count({ where: { workspaceId: s.workspaceId } }),
    ).toBe(0);

    const conta = await prisma.account.findFirstOrThrow({
      where: { workspaceId: s.workspaceId },
    });
    expect(conta.cachedBalanceCents).toBe(10_000);
  });

  it("responder só ao primeiro passo é suficiente", async () => {
    const s = await novoWorkspace("minimo");

    const resultado = await applySetup(s, {
      conta: { name: "Carteira", type: "CASH", openingCents: 2_500 },
      fixas: {},
    });

    expect(resultado.contasCriadas).toBe(1);
    expect(resultado.fontesCriadas).toBe(0);
    expect(resultado.veiculoCriado).toBe(false);
    expect(resultado.linhasOrcamento).toBe(0);
    expect(await needsSetup(s.workspaceId)).toBe(false);
  });

  it("correr duas vezes não duplica nada", async () => {
    const s = await novoWorkspace("repetido");
    const entrada = {
      conta: { name: "Conta à ordem", type: "BANK" as const, openingCents: 30_000 },
      rendimentos: [
        { name: "Ordenado", type: "SALARY" as const, mensalCents: 90_000 },
      ],
      veiculo: {
        name: "Honda PCX",
        type: "SCOOTER" as const,
        fuelType: "PETROL" as const,
        currentMetres: 1_000,
        combustivelMensalCents: 8_000,
      },
      habitacao: "ARRENDO" as const,
      habitacaoCents: 50_000,
      fixas: {},
    };

    await applySetup(s, entrada);
    const segunda = await applySetup(s, entrada);

    expect(segunda.contasCriadas).toBe(0);
    expect(segunda.fontesCriadas).toBe(0);
    expect(segunda.veiculoCriado).toBe(false);

    expect(
      await prisma.account.count({ where: { workspaceId: s.workspaceId } }),
    ).toBe(1);
    expect(
      await prisma.incomeSource.count({ where: { workspaceId: s.workspaceId } }),
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
