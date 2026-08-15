/**
 * Datas das recorrências.
 *
 * É aqui que estas coisas se partem: meses de 30 dias, fevereiro, anos
 * bissextos, passagens de ano. Uma renda marcada para dia 31 que salta cinco
 * meses por ano não dá erro nenhum — simplesmente não aparece, e a pessoa só
 * dá por isso quando o senhorio liga.
 *
 * A função é pura de propósito, para se poder testar tudo isto sem base de
 * dados.
 */

import { describe, expect, it } from "vitest";
import { ocorrenciasEntre } from "@/server/recurring";
import { fromIso } from "@/lib/date";

function regra(over: Partial<Parameters<typeof ocorrenciasEntre>[0]> = {}) {
  return {
    frequency: "MONTHLY" as const,
    dayOfMonth: 1,
    weekday: null,
    monthOfYear: null,
    startDate: fromIso("2026-01-01"),
    endDate: null,
    ...over,
  };
}

describe("ocorrências de uma recorrência", () => {
  it("mensal no dia 1, ao longo de um trimestre", () => {
    expect(
      ocorrenciasEntre(regra(), "2026-01-01", "2026-03-31"),
    ).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
  });

  it("dia 31 usa o último dia dos meses curtos, em vez de saltar", () => {
    const datas = ocorrenciasEntre(
      regra({ dayOfMonth: 31 }),
      "2026-01-01",
      "2026-06-30",
    );
    expect(datas).toEqual([
      "2026-01-31",
      "2026-02-28", // 2026 não é bissexto
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
      "2026-06-30",
    ]);
  });

  it("respeita o 29 de fevereiro num ano bissexto", () => {
    const datas = ocorrenciasEntre(
      regra({ dayOfMonth: 31, startDate: fromIso("2028-01-01") }),
      "2028-02-01",
      "2028-02-29",
    );
    expect(datas).toEqual(["2028-02-29"]);
  });

  it("atravessa a passagem de ano", () => {
    const datas = ocorrenciasEntre(
      regra({ dayOfMonth: 15, startDate: fromIso("2026-11-01") }),
      "2026-11-01",
      "2027-02-28",
    );
    expect(datas).toEqual([
      "2026-11-15",
      "2026-12-15",
      "2027-01-15",
      "2027-02-15",
    ]);
  });

  it("nunca devolve datas anteriores ao início da regra", () => {
    const datas = ocorrenciasEntre(
      regra({ startDate: fromIso("2026-03-10") }),
      "2026-01-01",
      "2026-05-31",
    );
    // Março já passou do dia 1 quando a regra começa, por isso só abril.
    expect(datas).toEqual(["2026-04-01", "2026-05-01"]);
  });

  it("pára no fim, quando há fim", () => {
    const datas = ocorrenciasEntre(
      regra({ endDate: fromIso("2026-03-15") }),
      "2026-01-01",
      "2026-12-31",
    );
    expect(datas).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
  });

  it("trimestral salta de três em três meses", () => {
    const datas = ocorrenciasEntre(
      regra({ frequency: "QUARTERLY", dayOfMonth: 5 }),
      "2026-01-01",
      "2026-12-31",
    );
    expect(datas).toEqual([
      "2026-01-05",
      "2026-04-05",
      "2026-07-05",
      "2026-10-05",
    ]);
  });

  it("anual só no mês indicado", () => {
    const datas = ocorrenciasEntre(
      regra({ frequency: "YEARLY", dayOfMonth: 20, monthOfYear: 6 }),
      "2026-01-01",
      "2028-12-31",
    );
    expect(datas).toEqual(["2026-06-20", "2027-06-20", "2028-06-20"]);
  });

  it("semanal cai sempre no mesmo dia da semana", () => {
    // 2026-01-01 é uma quinta-feira. Pedimos segundas (1).
    const datas = ocorrenciasEntre(
      regra({ frequency: "WEEKLY", weekday: 1, dayOfMonth: null }),
      "2026-01-01",
      "2026-01-31",
    );
    for (const d of datas) {
      const dia = fromIso(d).getUTCDay();
      expect(dia).toBe(1); // segunda
    }
    expect(datas.length).toBeGreaterThanOrEqual(4);
  });

  it("janela fora do período de vida da regra devolve vazio", () => {
    expect(
      ocorrenciasEntre(
        regra({ startDate: fromIso("2027-01-01") }),
        "2026-01-01",
        "2026-12-31",
      ),
    ).toEqual([]);
  });
});
