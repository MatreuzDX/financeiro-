import { describe, expect, it } from "vitest";
import {
  calcularHabito,
  calcularMedalhas,
  fraseDoHabito,
} from "@/lib/habito";

const HOJE = "2026-08-16";

describe("sequência", () => {
  it("conta os dias seguidos até hoje", () => {
    const h = calcularHabito(["2026-08-14", "2026-08-15", "2026-08-16"], HOJE);
    expect(h.atual).toBe(3);
    expect(h.hojeFeito).toBe(true);
  });

  it("NÃO parte só porque ainda não registou hoje", () => {
    // Senão a sequência morria todas as manhãs até se abrir a app.
    const h = calcularHabito(["2026-08-14", "2026-08-15"], HOJE);
    expect(h.atual).toBe(2);
    expect(h.hojeFeito).toBe(false);
  });

  it("perdoa um dia falhado", () => {
    // Falhou o dia 14, mas registou 12, 13, 15 e 16.
    const h = calcularHabito(
      ["2026-08-12", "2026-08-13", "2026-08-15", "2026-08-16"],
      HOJE,
    );
    expect(h.atual).toBe(4);
    expect(h.perdaoUsado).toBe(true);
  });

  it("não perdoa dois", () => {
    const h = calcularHabito(
      ["2026-08-11", "2026-08-12", "2026-08-15", "2026-08-16"],
      HOJE,
    );
    expect(h.atual).toBe(2);
  });

  it("sem registos nenhuns a sequência é zero", () => {
    const h = calcularHabito([], HOJE);
    expect(h.atual).toBe(0);
    expect(h.recorde).toBe(0);
    expect(h.perdaoUsado).toBe(false);
  });

  it("o recorde não usa perdões — é a medida honesta", () => {
    const h = calcularHabito(
      ["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-05", "2026-08-16"],
      HOJE,
    );
    expect(h.recorde).toBe(3);
  });

  it("devolve sempre sete dias, do mais antigo para o mais recente", () => {
    const h = calcularHabito(["2026-08-16"], HOJE);
    expect(h.ultimosSete).toHaveLength(7);
    expect(h.ultimosSete[0].dia).toBe("2026-08-10");
    expect(h.ultimosSete[6].dia).toBe(HOJE);
    expect(h.ultimosSete[6].feito).toBe(true);
  });

  it("aguenta uma sequência longa sem se perder", () => {
    const dias = Array.from({ length: 120 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 7, 16));
      d.setUTCDate(d.getUTCDate() - i);
      return d.toISOString().slice(0, 10);
    });
    const h = calcularHabito(dias, HOJE);
    expect(h.atual).toBe(120);
    expect(h.recorde).toBe(120);
  });
});

describe("frases", () => {
  it("nunca castiga quem está a zero", () => {
    const frase = fraseDoHabito(calcularHabito([], HOJE));
    expect(frase).toMatch(/começa/i);
    expect(frase).not.toMatch(/falhou|perdeu|nunca/i);
  });

  it("diz que ainda vai a tempo quando não registou hoje", () => {
    const frase = fraseDoHabito(
      calcularHabito(["2026-08-14", "2026-08-15"], HOJE),
    );
    expect(frase).toMatch(/a tempo/i);
  });

  it("avisa quando a rede já foi usada", () => {
    const frase = fraseDoHabito(
      calcularHabito(["2026-08-13", "2026-08-15", "2026-08-16"], HOJE),
    );
    expect(frase).toMatch(/rede/i);
  });
});

describe("medalhas", () => {
  it("são todas por hábito, nenhuma por saldo", () => {
    // Se algum dia aparecer aqui uma medalha por euros poupados, é um erro:
    // premeia quem já tinha dinheiro e humilha quem não tem.
    const medalhas = calcularMedalhas(calcularHabito([], HOJE), 0, 0);
    const texto = medalhas.map((m) => `${m.titulo} ${m.descricao}`).join(" ");
    expect(texto).not.toMatch(/€|euros|poupou \d|saldo/i);
  });

  it("marcam o progresso mesmo quando ainda não se conquistou", () => {
    const h = calcularHabito(
      ["2026-08-14", "2026-08-15", "2026-08-16"],
      HOJE,
    );
    const semana = calcularMedalhas(h, 10, 0).find((m) => m.id === "seq-7");
    expect(semana?.conquistada).toBe(false);
    expect(semana?.progresso).toBe(43);
  });

  it("o progresso nunca passa dos 100", () => {
    const h = calcularHabito(["2026-08-16"], HOJE);
    for (const m of calcularMedalhas(h, 5000, 99)) {
      expect(m.progresso).toBeLessThanOrEqual(100);
    }
  });

  it("a primeira medalha chega com um movimento", () => {
    const m = calcularMedalhas(calcularHabito([], HOJE), 1, 0);
    expect(m.find((x) => x.id === "primeiro")?.conquistada).toBe(true);
  });
});
