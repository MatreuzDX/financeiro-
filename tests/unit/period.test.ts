import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
  toIso,
  fromIso,
  diffDays,
} from "@/lib/date";
import { resolvePeriod, bucketsFor } from "@/lib/period";

describe("datas em UTC", () => {
  it("não escorrega um dia por causa do fuso da máquina", () => {
    // Este é o teste que apanha o bug clássico: com hora local, o primeiro
    // dia do mês salta para o último dia do mês anterior.
    expect(startOfMonth("2026-08-01")).toBe("2026-08-01");
    expect(startOfMonth("2026-08-31")).toBe("2026-08-01");
    expect(endOfMonth("2026-08-01")).toBe("2026-08-31");
    expect(toIso(fromIso("2026-08-01"))).toBe("2026-08-01");
  });

  it("sabe quantos dias tem fevereiro", () => {
    expect(endOfMonth("2024-02-10")).toBe("2024-02-29"); // bissexto
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
  });

  it("31 de janeiro mais um mês é o fim de fevereiro, não 3 de março", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
  });

  it("a semana começa à segunda-feira", () => {
    // 2026-08-11 é uma terça-feira.
    expect(startOfWeek("2026-08-11")).toBe("2026-08-10");
    expect(endOfWeek("2026-08-11")).toBe("2026-08-16");
    // Domingo pertence à semana que começou na segunda anterior.
    expect(startOfWeek("2026-08-16")).toBe("2026-08-10");
  });

  it("atravessa a mudança da hora de verão sem perder dias", () => {
    // Em Portugal a hora muda no último domingo de março e de outubro.
    expect(diffDays("2026-03-28", "2026-03-30")).toBe(2);
    expect(diffDays("2026-10-24", "2026-10-26")).toBe(2);
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
  });
});

describe("períodos", () => {
  const today = "2026-08-11";

  it("este mês vai do dia 1 ao último dia", () => {
    const period = resolvePeriod({ periodo: "mes", today });
    expect(period.from).toBe("2026-08-01");
    expect(period.to).toBe("2026-08-31");
  });

  it("o período anterior tem a mesma duração e acaba na véspera", () => {
    const period = resolvePeriod({ periodo: "mes", today });
    expect(period.previous.to).toBe("2026-07-31");
    expect(diffDays(period.previous.from, period.previous.to)).toBe(
      diffDays(period.from, period.to),
    );
  });

  it("mês anterior é julho", () => {
    const period = resolvePeriod({ periodo: "mes-anterior", today });
    expect(period.from).toBe("2026-07-01");
    expect(period.to).toBe("2026-07-31");
  });

  it("últimos 3 meses inclui o mês atual inteiro", () => {
    const period = resolvePeriod({ periodo: "3-meses", today });
    expect(period.from).toBe("2026-06-01");
    expect(period.to).toBe("2026-08-31");
  });

  it("datas personalizadas trocadas são corrigidas em vez de darem vazio", () => {
    const period = resolvePeriod({
      periodo: "personalizado",
      de: "2026-08-20",
      ate: "2026-08-05",
      today,
    });
    expect(period.from).toBe("2026-08-05");
    expect(period.to).toBe("2026-08-20");
  });

  it("um período inválido cai no mês atual em vez de rebentar", () => {
    const period = resolvePeriod({ periodo: "não-existe", today });
    expect(period.key).toBe("mes");
  });

  it("períodos curtos são divididos por dia e longos por mês", () => {
    const short = bucketsFor(resolvePeriod({ periodo: "mes", today }));
    expect(short).toHaveLength(31);

    const long = bucketsFor(resolvePeriod({ periodo: "ano", today }));
    expect(long).toHaveLength(12);
  });
});
