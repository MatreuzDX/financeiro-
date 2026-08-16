/**
 * Ler extratos bancários.
 *
 * Cada teste aqui é um erro que custaria dinheiro real: uma data lida ao
 * contrário põe a despesa no mês errado, um débito lido como crédito
 * transforma uma despesa em receita, e um separador mal adivinhado importa
 * duzentas linhas de lixo.
 */

import { describe, expect, it } from "vitest";
import {
  detectColumns,
  detectDelimiter,
  extractRows,
  normalize,
  parseBankAmount,
  parseBankDate,
  parseGrid,
} from "@/lib/csv";

describe("datas de extrato", () => {
  it("lê o formato português", () => {
    expect(parseBankDate("15-08-2026")).toBe("2026-08-15");
    expect(parseBankDate("15/08/2026")).toBe("2026-08-15");
    expect(parseBankDate("15.08.2026")).toBe("2026-08-15");
    expect(parseBankDate("5/8/2026")).toBe("2026-08-05");
  });

  it("lê ISO e ignora a hora colada", () => {
    expect(parseBankDate("2026-08-15")).toBe("2026-08-15");
    expect(parseBankDate("2026-08-15 13:42")).toBe("2026-08-15");
    expect(parseBankDate("2026-08-15T13:42:00Z")).toBe("2026-08-15");
  });

  it("assume DIA primeiro — 05/03 é 5 de março, não 3 de maio", () => {
    // Se algum dia isto passar a devolver 2026-05-03, todas as despesas de
    // quem importa um extrato passam para o mês errado sem aviso nenhum.
    expect(parseBankDate("05/03/2026")).toBe("2026-03-05");
  });

  it("expande o ano de dois dígitos", () => {
    expect(parseBankDate("15-08-26")).toBe("2026-08-15");
  });

  it("recusa o que não é data em vez de adivinhar", () => {
    expect(parseBankDate("")).toBeNull();
    expect(parseBankDate("Descrição")).toBeNull();
    expect(parseBankDate("32-01-2026")).toBeNull();
    expect(parseBankDate("15-13-2026")).toBeNull();
  });
});

describe("valores de extrato", () => {
  it("lê o formato português com milhares", () => {
    expect(parseBankAmount("1.234,56")).toBe(123456);
    expect(parseBankAmount("-45,10")).toBe(-4510);
    expect(parseBankAmount("920")).toBe(92000);
  });

  it("lê parênteses como negativo", () => {
    expect(parseBankAmount("(45,10)")).toBe(-4510);
  });

  it("lê o sinal depois do número", () => {
    expect(parseBankAmount("45,10-")).toBe(-4510);
    expect(parseBankAmount("45,10+")).toBe(4510);
  });

  it("recusa texto", () => {
    expect(parseBankAmount("")).toBeNull();
    expect(parseBankAmount("n/d")).toBeNull();
  });
});

describe("separador", () => {
  it("escolhe o ponto e vírgula mesmo com vírgulas nas descrições", () => {
    // O erro clássico: contar vírgulas e escolher a vírgula. Aqui há 6
    // vírgulas e só 3 pontos e vírgula, mas só o `;` dá colunas consistentes.
    const linhas = [
      "Data;Descricao;Valor",
      "15-08-2026;TRF P/ SILVA, MARIA;-50,00",
      "16-08-2026;COMPRA PINGO DOCE, LISBOA;-23,40",
      "17-08-2026;PAGAMENTO EDP, FATURA;-61,20",
    ];
    expect(detectDelimiter(linhas)).toBe(";");
  });

  it("reconhece a vírgula quando é mesmo o separador", () => {
    const linhas = [
      "Date,Description,Amount",
      "2026-08-15,Coffee,-2.40",
      "2026-08-16,Salary,1500.00",
    ];
    expect(detectDelimiter(linhas)).toBe(",");
  });
});

describe("extrato de banco português, com preâmbulo", () => {
  const ficheiro = [
    "Consulta de movimentos",
    "Conta: 0000 0000 0000",
    "",
    "Data movimento;Data valor;Descricao;Debito;Credito;Saldo",
    "15-08-2026;15-08-2026;COMPRA 4321 PINGO DOCE LISBOA;23,40;;1.976,60",
    "16-08-2026;16-08-2026;ORDENADO AGOSTO;;920,00;2.896,60",
    "17-08-2026;17-08-2026;PAGAMENTO EDP FATURA 993211;61,20;;2.835,40",
  ].join("\r\n");

  it("salta o preâmbulo e encontra o cabeçalho", () => {
    const grid = parseGrid(ficheiro);
    expect(grid).not.toBeNull();
    expect(grid!.header[0]).toBe("Data movimento");
    expect(grid!.rows).toHaveLength(3);
  });

  it("distingue débito de crédito e NUNCA troca o sinal", () => {
    const grid = parseGrid(ficheiro)!;
    const map = detectColumns(grid.header, grid.rows);
    const linhas = extractRows(grid, map);

    // O erro mais caro possível: importar uma despesa como receita.
    expect(linhas[0].amountCents).toBe(-2340);
    expect(linhas[1].amountCents).toBe(92000);
    expect(linhas[2].amountCents).toBe(-6120);
    expect(linhas.every((l) => l.problem === null)).toBe(true);
  });

  it("NÃO confunde a coluna Saldo com a do valor", () => {
    const grid = parseGrid(ficheiro)!;
    const map = detectColumns(grid.header, grid.rows);
    const saldo = grid.header.indexOf("Saldo");
    expect(map.valor).not.toBe(saldo);
    expect(map.debito).not.toBe(saldo);
    expect(map.credito).not.toBe(saldo);
  });

  it("usa a primeira coluna de data, não a data-valor", () => {
    const grid = parseGrid(ficheiro)!;
    const map = detectColumns(grid.header, grid.rows);
    expect(map.data).toBe(0);
  });
});

describe("extrato de coluna única de valor", () => {
  const ficheiro = [
    "Data;Descrição;Montante;Saldo",
    "15-08-2026;COMPRA CONTINENTE;-23,40;1.976,60",
    "16-08-2026;ORDENADO;920,00;2.896,60",
  ].join("\n");

  it("lê os sinais tal como vêm", () => {
    const grid = parseGrid(ficheiro)!;
    const map = detectColumns(grid.header, grid.rows);
    const linhas = extractRows(grid, map);
    expect(linhas[0].amountCents).toBe(-2340);
    expect(linhas[1].amountCents).toBe(92000);
    expect(linhas[0].description).toBe("COMPRA CONTINENTE");
  });
});

describe("ficheiro sem cabeçalho reconhecível", () => {
  it("adivinha as colunas pelo conteúdo", () => {
    const ficheiro = [
      "15-08-2026;COMPRA CONTINENTE;-23,40",
      "16-08-2026;ORDENADO AGOSTO;920,00",
      "17-08-2026;FARMACIA CENTRAL;-12,80",
    ].join("\n");

    const grid = parseGrid(ficheiro)!;
    const map = detectColumns(grid.header, grid.rows);
    const linhas = extractRows(grid, map);
    // A primeira linha do ficheiro vira cabeçalho, mas as outras leem-se bem —
    // é o comportamento honesto: melhor perder uma linha visível na
    // pré-visualização do que inventar um cabeçalho.
    expect(map.data).toBe(0);
    expect(map.valor).toBe(2);
    expect(linhas.every((l) => l.problem === null)).toBe(true);
  });
});

describe("descrições com o separador lá dentro", () => {
  it("respeita as aspas", () => {
    const ficheiro = [
      'Data;Descrição;Valor',
      '15-08-2026;"TRF P/ SILVA, MARIA; REF 22";-50,00',
    ].join("\n");
    const grid = parseGrid(ficheiro)!;
    const map = detectColumns(grid.header, grid.rows);
    const linhas = extractRows(grid, map);
    expect(linhas[0].description).toBe("TRF P/ SILVA, MARIA; REF 22");
    expect(linhas[0].amountCents).toBe(-5000);
  });
});

describe("linhas más", () => {
  it("são marcadas, não deitadas fora em silêncio", () => {
    const ficheiro = [
      "Data;Descrição;Valor",
      "15-08-2026;COMPRA CONTINENTE;-23,40",
      "não é data;QUALQUER COISA;-10,00",
      "17-08-2026;;-12,80",
      "18-08-2026;SEM VALOR;",
    ].join("\n");

    const grid = parseGrid(ficheiro)!;
    const linhas = extractRows(grid, detectColumns(grid.header, grid.rows));

    expect(linhas).toHaveLength(4);
    expect(linhas[0].problem).toBeNull();
    expect(linhas[1].problem).toMatch(/data/i);
    expect(linhas[2].problem).toMatch(/descrição/i);
    expect(linhas[3].problem).toMatch(/valor/i);
    // E diz em que linha do ficheiro o problema está.
    expect(linhas[1].lineNumber).toBe(3);
  });
});

describe("normalize", () => {
  it("tira acentos e maiúsculas", () => {
    expect(normalize("Descrição")).toBe("descricao");
    expect(normalize("  PINGO DOCE  ")).toBe("pingo doce");
  });
});

describe("BOM do Excel", () => {
  it("não estraga a primeira coluna", () => {
    const grid = parseGrid("﻿Data;Descrição;Valor\n15-08-2026;X;-1,00")!;
    expect(grid.header[0]).toBe("Data");
  });
});
