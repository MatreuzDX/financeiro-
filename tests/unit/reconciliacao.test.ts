import { describe, expect, it } from "vitest";
import { candidatos, compararSaldo } from "@/lib/reconciliacao";

describe("comparar com o banco", () => {
  it("bate certo quando os valores são iguais", () => {
    const d = compararSaldo(123_456, 123_456);
    expect(d.bate).toBe(true);
    expect(d.diferencaCents).toBe(0);
    expect(d.gravidade).toBe("certo");
  });

  it("um cêntimo de diferença NÃO é 'quase certo'", () => {
    // Com dinheiro em cêntimos inteiros não há tolerância: ou bate ou não.
    // Uma tolerância aqui esconderia exatamente o tipo de erro que isto
    // existe para apanhar.
    const d = compararSaldo(123_457, 123_456);
    expect(d.bate).toBe(false);
    expect(d.diferencaCents).toBe(1);
  });

  it("banco acima da app: falta registar dinheiro que entrou", () => {
    const d = compararSaldo(150_000, 100_000);
    expect(d.diferencaCents).toBe(50_000);
    expect(d.sugestao).toMatch(/entrou/i);
  });

  it("app acima do banco: falta registar dinheiro que saiu", () => {
    const d = compararSaldo(100_000, 150_000);
    expect(d.diferencaCents).toBe(-50_000);
    expect(d.sugestao).toMatch(/saiu/i);
    expect(d.sugestao).toMatch(/levantamento|comissão/i);
  });

  it("distingue uma diferença pequena de uma grande", () => {
    expect(compararSaldo(100_120, 100_000).gravidade).toBe("pequena");
    expect(compararSaldo(105_000, 100_000).gravidade).toBe("grande");
  });

  it("funciona com saldos negativos", () => {
    const d = compararSaldo(-5_000, -3_000);
    expect(d.diferencaCents).toBe(-2_000);
    expect(d.bate).toBe(false);
  });
});

describe("candidatos a explicar a diferença", () => {
  const movimentos = [
    { id: "a", amountCents: 2_340 },
    { id: "b", amountCents: 5_000 },
    { id: "c", amountCents: -5_000 },
    { id: "d", amountCents: 1_200 },
  ];

  it("encontra o movimento com o valor exato, em qualquer sentido", () => {
    const c = candidatos(5_000, movimentos);
    expect(c.map((m) => m.id).sort()).toEqual(["b", "c"]);
  });

  it("apanha também quando a diferença vem negativa", () => {
    expect(candidatos(-2_340, movimentos).map((m) => m.id)).toEqual(["a"]);
  });

  it("não inventa nada quando nenhum valor bate", () => {
    // Deliberadamente NÃO se procuram combinações de dois ou três: com dez
    // candidatos há mil somas possíveis e quase todas são coincidência.
    expect(candidatos(3_540, movimentos)).toHaveLength(0);
  });

  it("sem diferença não há nada a sugerir", () => {
    expect(candidatos(0, movimentos)).toHaveLength(0);
  });
});
