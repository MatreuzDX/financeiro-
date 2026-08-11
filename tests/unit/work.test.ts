import { describe, expect, it } from "vitest";
import { computeGrossCents } from "@/server/work";
import { composeEntries } from "@/server/ledger";

const empty = {
  distanceMetres: 0,
  ratePerKmCents: 0,
  deliveries: 0,
  ratePerDeliveryCents: 0,
  hoursTenths: 0,
  ratePerHourCents: 0,
  fixedCents: 0,
  tipsCents: 0,
};

describe("receita de um trabalho", () => {
  it("o exemplo do plano: 150 km × 0,40 €/km = 60,00 €", () => {
    expect(
      computeGrossCents({
        ...empty,
        payModel: "PER_KM",
        distanceMetres: 150_000,
        ratePerKmCents: 40,
      }),
    ).toBe(6_000);
  });

  it("por entrega", () => {
    expect(
      computeGrossCents({
        ...empty,
        payModel: "PER_DELIVERY",
        deliveries: 14,
        ratePerDeliveryCents: 285,
      }),
    ).toBe(3_990);
  });

  it("por hora, com meias horas", () => {
    // 4,5 h × 9,50 €/h = 42,75 €
    expect(
      computeGrossCents({
        ...empty,
        payModel: "HOURLY",
        hoursTenths: 45,
        ratePerHourCents: 950,
      }),
    ).toBe(4_275);
  });

  it("valor fixo mais gorjetas", () => {
    expect(
      computeGrossCents({
        ...empty,
        payModel: "FIXED",
        fixedCents: 5_000,
        tipsCents: 350,
      }),
    ).toBe(5_350);
  });

  it("as gorjetas somam a qualquer modelo", () => {
    expect(
      computeGrossCents({
        ...empty,
        payModel: "PER_KM",
        distanceMetres: 150_000,
        ratePerKmCents: 40,
        tipsCents: 500,
      }),
    ).toBe(6_500);
  });
});

describe("composição das linhas do livro", () => {
  const base = {
    date: "2026-08-11",
    description: "Teste",
    amountCents: 5_000,
    notes: null,
    scope: "PERSONAL" as const,
  };

  it("uma despesa tira da conta e põe na categoria", () => {
    const entries = composeEntries({
      ...base,
      type: "EXPENSE",
      accountId: "conta",
      categoryId: "categoria",
      vehicleId: null,
    });
    expect(entries).toEqual([
      { accountId: "conta", amountCents: -5_000 },
      { categoryId: "categoria", amountCents: 5_000 },
    ]);
    expect(entries.reduce((s, e) => s + e.amountCents, 0)).toBe(0);
  });

  it("uma receita põe na conta e tira da categoria", () => {
    const entries = composeEntries({
      ...base,
      type: "INCOME",
      accountId: "conta",
      categoryId: "categoria",
      incomeSourceId: null,
      vehicleId: null,
      workJobId: null,
    });
    expect(entries[0].amountCents).toBe(5_000);
    expect(entries[1].amountCents).toBe(-5_000);
    expect(entries.reduce((s, e) => s + e.amountCents, 0)).toBe(0);
  });

  it("uma transferência não toca em categoria nenhuma", () => {
    // É isto que impede uma transferência de inflacionar o lucro.
    const entries = composeEntries({
      ...base,
      type: "TRANSFER",
      fromAccountId: "origem",
      toAccountId: "destino",
    });
    expect(entries.every((e) => e.categoryId === undefined)).toBe(true);
    expect(entries.reduce((s, e) => s + e.amountCents, 0)).toBe(0);
  });

  it("todas as composições somam zero, seja qual for o valor", () => {
    for (const amountCents of [1, 7, 99, 1_234, 92_000, 2_147_483]) {
      const expense = composeEntries({
        ...base,
        amountCents,
        type: "EXPENSE",
        accountId: "a",
        categoryId: "c",
        vehicleId: null,
      });
      expect(expense.reduce((s, e) => s + e.amountCents, 0)).toBe(0);
    }
  });
});
