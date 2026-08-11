import { describe, expect, it } from "vitest";
import {
  consumptionPer100Km,
  costPerKmCents,
  divRound,
  formatCents,
  fuelTotalCents,
  kmPayToCents,
  parseAmountToCents,
  parseKmToMetres,
  sumCents,
  MoneyError,
} from "@/lib/money";

describe("divRound", () => {
  it("arredonda 0,5 para longe do zero", () => {
    expect(divRound(5, 2)).toBe(3);
    expect(divRound(-5, 2)).toBe(-3);
    expect(divRound(4, 2)).toBe(2);
    expect(divRound(1, 3)).toBe(0);
    expect(divRound(2, 3)).toBe(1);
  });

  it("recusa dividir por zero", () => {
    expect(() => divRound(1, 0)).toThrow(MoneyError);
  });
});

describe("parseAmountToCents", () => {
  it("lê os formatos que uma pessoa realmente escreve", () => {
    expect(parseAmountToCents("920")).toBe(92_000);
    expect(parseAmountToCents("920,00")).toBe(92_000);
    expect(parseAmountToCents("920.00")).toBe(92_000);
    expect(parseAmountToCents("12,40")).toBe(1_240);
    expect(parseAmountToCents("0,05")).toBe(5);
    expect(parseAmountToCents("€12,40")).toBe(1_240);
    expect(parseAmountToCents(" 12,4 ")).toBe(1_240);
    expect(parseAmountToCents("-15")).toBe(-1_500);
  });

  it("percebe separadores de milhares nos dois formatos", () => {
    expect(parseAmountToCents("1.234,56")).toBe(123_456);
    expect(parseAmountToCents("1,234.56")).toBe(123_456);
    expect(parseAmountToCents("1.234")).toBe(123_400);
  });

  it("rejeita o que não é um valor", () => {
    expect(parseAmountToCents("")).toBeNull();
    expect(parseAmountToCents("abc")).toBeNull();
    expect(parseAmountToCents("12,345")).toBeNull();
    expect(parseAmountToCents("1,2,3")).toBeNull();
    expect(parseAmountToCents("99999999999999")).toBeNull();
  });
});

describe("somas em cêntimos", () => {
  it("não sofre do erro clássico da vírgula flutuante", () => {
    // 0.1 + 0.2 !== 0.3 em vírgula flutuante. Em cêntimos, é exato.
    expect(sumCents([10, 20])).toBe(30);
    const cents = [1_234, 5_678, 9_012, 3_456];
    expect(sumCents(cents)).toBe(19_380);
  });

  it("a ordem da soma não altera o resultado", () => {
    const values = [1_234, -567, 89, -1_000, 4_321];
    const forward = sumCents(values);
    const backward = sumCents([...values].reverse());
    expect(forward).toBe(backward);
  });

  it("€920,00 continua €920,00 depois de cem somas e subtrações", () => {
    let total = 92_000;
    for (let i = 0; i < 100; i++) total = sumCents([total, 137, -137]);
    expect(total).toBe(92_000);
    expect(formatCents(total)).toContain("920,00");
  });

  it("recusa valores que não são inteiros", () => {
    expect(() => sumCents([10.5])).toThrow(MoneyError);
  });
});

describe("pagamento ao quilómetro", () => {
  it("150 km a 0,40 €/km dá exatamente 60,00 € — nem 59,99 nem 60,01", () => {
    expect(kmPayToCents(150_000, 40)).toBe(6_000);
  });

  it("arredonda uma só vez, no fim", () => {
    // 33,333 km × 0,37 €/km = 12,333... € → 12,33 €
    expect(kmPayToCents(33_333, 37)).toBe(1_233);
  });

  it("zero quilómetros não rende nada", () => {
    expect(kmPayToCents(0, 40)).toBe(0);
  });
});

describe("combustível", () => {
  it("40 L a 1,689 €/L dá 67,56 €", () => {
    expect(fuelTotalCents(40_000, 16_890)).toBe(6_756);
  });

  it("6,5 L a 1,715 €/L dá 11,15 €", () => {
    // 6,5 × 1,715 = 11,1475 → 11,15
    expect(fuelTotalCents(6_500, 17_150)).toBe(1_115);
  });
});

describe("custo por quilómetro", () => {
  it("devolve null quando não há quilómetros — não inventa", () => {
    expect(costPerKmCents(5_000, 0)).toBeNull();
  });

  it("84,20 € em 1026 km dá 8,2 cêntimos por km", () => {
    expect(costPerKmCents(8_420, 1_026_000)).toBe(8);
  });
});

describe("consumo", () => {
  it("calcula litros por 100 km", () => {
    expect(consumptionPer100Km(3_000, 100_000)).toBe(3);
  });

  it("devolve null sem quilómetros", () => {
    expect(consumptionPer100Km(3_000, 0)).toBeNull();
  });
});

describe("quilómetros", () => {
  it("lê km com vírgula ou ponto", () => {
    expect(parseKmToMetres("150")).toBe(150_000);
    expect(parseKmToMetres("24150,5")).toBe(24_150_500);
    expect(parseKmToMetres("24150.5")).toBe(24_150_500);
  });

  it("rejeita o que não é distância", () => {
    expect(parseKmToMetres("")).toBeNull();
    expect(parseKmToMetres("-10")).toBeNull();
    expect(parseKmToMetres("abc")).toBeNull();
  });
});
