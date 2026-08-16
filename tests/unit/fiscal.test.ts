/**
 * O dinheiro que não é seu.
 *
 * Estes testes fixam contas que, se saírem erradas, fazem alguém guardar a
 * menos e levar com uma nota da Segurança Social que não esperava. São contas
 * simples de propósito — a complexidade aqui seria um defeito.
 */

import { describe, expect, it } from "vitest";
import {
  calcularReserva,
  calendarioFiscal,
  isentoDeSegurancaSocial,
  mesesDeAtividade,
  PERFIL_OMISSAO,
  projecaoIva,
  TAXAS,
  type PerfilFiscal,
} from "@/lib/fiscal";

const HOJE = "2026-08-16";

function perfil(patch: Partial<PerfilFiscal> = {}): PerfilFiscal {
  return { ...PERFIL_OMISSAO, independente: true, ...patch };
}

describe("quem não é independente", () => {
  it("não guarda nada — nada disto se lhe aplica", () => {
    const r = calcularReserva(100_000, perfil({ independente: false }), HOJE);
    expect(r.guardarCents).toBe(0);
    expect(r.seuCents).toBe(100_000);
    expect(r.parcelas).toHaveLength(0);
  });
});

describe("Segurança Social", () => {
  it("21,4% sobre 70% do faturado — 14,98% do total", () => {
    // €1 000 faturados → relevante €700 → 21,4% = €149,80
    const r = calcularReserva(100_000, perfil(), HOJE);
    const ss = r.parcelas.find((p) => p.chave === "SS");
    expect(ss?.cents).toBe(14_980);
  });

  it("não incide sobre o IVA, só sobre o serviço", () => {
    // Com IVA a 23%, entram €1 230 na conta, mas a SS é sobre os €1 000.
    const r = calcularReserva(100_000, perfil({ regimeIva: "NORMAL" }), HOJE);
    expect(r.recebidoCents).toBe(123_000);
    expect(r.parcelas.find((p) => p.chave === "SS")?.cents).toBe(14_980);
  });

  it("mostra a conta que fez, para se poder conferir", () => {
    const r = calcularReserva(100_000, perfil(), HOJE);
    const ss = r.parcelas.find((p) => p.chave === "SS");
    expect(ss?.conta).toContain("21,4%");
    expect(ss?.conta).toContain("70%");
  });
});

describe("isenção dos primeiros 12 meses", () => {
  it("no mês 0 e no mês 11 está isento", () => {
    expect(isentoDeSegurancaSocial(perfil({ inicioAtividade: "2026-08" }), HOJE)).toBe(true);
    expect(isentoDeSegurancaSocial(perfil({ inicioAtividade: "2025-09" }), HOJE)).toBe(true);
  });

  it("no mês 12 deixa de estar", () => {
    // Setembro de 2025 + 12 meses = agosto de 2026 é o mês 11; julho de 2025
    // dá 13 meses e já não é isento.
    expect(isentoDeSegurancaSocial(perfil({ inicioAtividade: "2025-08" }), HOJE)).toBe(false);
    expect(isentoDeSegurancaSocial(perfil({ inicioAtividade: "2024-01" }), HOJE)).toBe(false);
  });

  it("sem data de início NÃO se promete isenção nenhuma", () => {
    // Prometer isenção por omissão faria alguém guardar a menos.
    expect(isentoDeSegurancaSocial(perfil({ inicioAtividade: null }), HOJE)).toBe(false);
  });

  it("durante a isenção não cria parcela de SS, mas avisa quando acaba", () => {
    const r = calcularReserva(100_000, perfil({ inicioAtividade: "2026-06" }), HOJE);
    expect(r.parcelas.find((p) => p.chave === "SS")).toBeUndefined();
    expect(r.avisos.join(" ")).toMatch(/isento/i);
    expect(r.avisos.join(" ")).toMatch(/10 meses/);
  });

  it("conta os meses certos", () => {
    expect(mesesDeAtividade("2026-08", HOJE)).toBe(0);
    expect(mesesDeAtividade("2025-08", HOJE)).toBe(12);
    expect(mesesDeAtividade(null, HOJE)).toBeNull();
  });
});

describe("IVA", () => {
  it("isento pelo art. 53.º não guarda IVA nenhum", () => {
    const r = calcularReserva(100_000, perfil({ regimeIva: "ISENTO_ART53" }), HOJE);
    expect(r.parcelas.find((p) => p.chave === "IVA")).toBeUndefined();
    expect(r.recebidoCents).toBe(100_000);
  });

  it("no regime normal, o IVA recebido é do Estado", () => {
    const r = calcularReserva(100_000, perfil({ regimeIva: "NORMAL" }), HOJE);
    expect(r.parcelas.find((p) => p.chave === "IVA")?.cents).toBe(23_000);
  });
});

describe("IRS", () => {
  it("com retenção na fonte não há nada a guardar — o dinheiro nem chega", () => {
    const r = calcularReserva(100_000, perfil({ retencaoNaFonte: true }), HOJE);
    expect(r.parcelas.find((p) => p.chave === "IRS")).toBeUndefined();
    expect(r.avisos.join(" ")).toMatch(/retido pelo cliente/i);
  });

  it("sem retenção, guarda-se para o acerto anual", () => {
    const r = calcularReserva(100_000, perfil({ retencaoNaFonte: false }), HOJE);
    expect(r.parcelas.find((p) => p.chave === "IRS")?.cents).toBe(20_000);
  });

  it("diz sempre que é estimativa, nunca conta exata", () => {
    const r = calcularReserva(100_000, perfil(), HOJE);
    expect(r.avisos.join(" ")).toMatch(/estimativa/i);
  });
});

describe("o caso completo", () => {
  it("independente, IVA normal, sem retenção", () => {
    // Fatura €1 000 + €230 de IVA. Recebe €1 230.
    //   IVA  230,00
    //   SS   149,80
    //   IRS  200,00  (estimativa)
    //   ────────────
    //        579,80 não é seu → sobram 650,20
    const r = calcularReserva(
      100_000,
      perfil({ regimeIva: "NORMAL", retencaoNaFonte: false }),
      HOJE,
    );
    expect(r.recebidoCents).toBe(123_000);
    expect(r.guardarCents).toBe(57_980);
    expect(r.seuCents).toBe(65_020);
  });

  it("as parcelas somam sempre o total a guardar", () => {
    const r = calcularReserva(87_654, perfil({ regimeIva: "NORMAL" }), HOJE);
    const soma = r.parcelas.reduce((s, p) => s + p.cents, 0);
    expect(soma).toBe(r.guardarCents);
    expect(r.seuCents + r.guardarCents).toBe(r.recebidoCents);
  });

  it("tudo em cêntimos inteiros, sem frações a fugir", () => {
    const r = calcularReserva(33_333, perfil({ regimeIva: "NORMAL" }), HOJE);
    for (const p of r.parcelas) expect(Number.isInteger(p.cents)).toBe(true);
    expect(Number.isInteger(r.guardarCents)).toBe(true);
  });

  it("taxas alteradas pelo utilizador são respeitadas", () => {
    const r = calcularReserva(100_000, perfil({ taxaSsPercent: 25 }), HOJE);
    expect(r.parcelas.find((p) => p.chave === "SS")?.cents).toBe(17_500);
  });
});

describe("calendário", () => {
  it("só mostra o que ainda está para vir", () => {
    const datas = calendarioFiscal(perfil(), HOJE).map((o) => o.data);
    expect(datas.every((d) => d >= HOJE)).toBe(true);
    expect(datas).toEqual([...datas].sort());
  });

  it("tem a contribuição de outubro", () => {
    const outubro = calendarioFiscal(perfil(), HOJE).find((o) =>
      o.data.startsWith("2026-10"),
    );
    expect(outubro?.periodo).toMatch(/julho a setembro/);
  });

  it("quem não é independente não tem calendário nenhum", () => {
    expect(calendarioFiscal(perfil({ independente: false }), HOJE)).toHaveLength(0);
  });

  it("quem é isento de IVA não vê declarações de IVA", () => {
    const cal = calendarioFiscal(perfil({ regimeIva: "ISENTO_ART53" }), HOJE);
    expect(cal.some((o) => o.titulo.includes("IVA"))).toBe(false);
  });
});

describe("limite do IVA", () => {
  it("avisa quando a projeção passa os 13 500 €", () => {
    // €8 000 em 6 meses → projeção €16 000 → passa.
    const p = projecaoIva(800_000, 6);
    expect(p.projecaoCents).toBe(1_600_000);
    expect(p.vaiUltrapassar).toBe(true);
  });

  it("não avisa quem vai a caminho de ficar abaixo", () => {
    const p = projecaoIva(400_000, 6);
    expect(p.projecaoCents).toBe(800_000);
    expect(p.vaiUltrapassar).toBe(false);
  });

  it("o limite é o do art. 53.º", () => {
    expect(TAXAS.iva.limiteIsencaoArt53Cents).toBe(1_350_000);
  });
});
