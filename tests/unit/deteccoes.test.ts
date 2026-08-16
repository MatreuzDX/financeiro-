import { describe, expect, it } from "vitest";
import {
  detetarAnomalias,
  detetarSubscricoes,
  fundoDeEmergencia,
  repartir,
  type MovimentoSimples,
} from "@/lib/deteccoes";

let contador = 0;
function m(
  date: string,
  description: string,
  amountCents: number,
  categoryName: string | null = "Compras",
): MovimentoSimples {
  return { id: `m${contador++}`, date, description, amountCents, categoryName };
}

describe("subscrições", () => {
  it("apanha uma cobrança mensal regular", () => {
    const subs = detetarSubscricoes([
      m("2026-05-10", "NETFLIX.COM 4421", 1399, "Subscrições"),
      m("2026-06-10", "NETFLIX.COM 8830", 1399, "Subscrições"),
      m("2026-07-10", "NETFLIX.COM 1102", 1399, "Subscrições"),
    ]);
    expect(subs).toHaveLength(1);
    expect(subs[0].ocorrencias).toBe(3);
    expect(subs[0].cadenciaDias).toBeGreaterThanOrEqual(29);
    // 13,99 × 12 ≈ 167,88 por ano — o número que faz alguém cancelar.
    expect(subs[0].anualCents).toBeGreaterThan(16000);
    expect(subs[0].anualCents).toBeLessThan(17500);
  });

  it("NÃO confunde o supermercado com uma subscrição", () => {
    // Dez idas ao supermercado em datas irregulares e valores diferentes.
    const compras = [
      m("2026-07-01", "CONTINENTE", 4320, "Supermercado"),
      m("2026-07-03", "CONTINENTE", 1210, "Supermercado"),
      m("2026-07-04", "CONTINENTE", 8790, "Supermercado"),
      m("2026-07-11", "CONTINENTE", 2340, "Supermercado"),
      m("2026-07-19", "CONTINENTE", 6650, "Supermercado"),
    ];
    expect(detetarSubscricoes(compras)).toHaveLength(0);
  });

  it("exige regularidade, não apenas repetição", () => {
    // Mesmo valor, mas intervalos de 30, 5 e 90 dias.
    const irregular = [
      m("2026-01-10", "GINASIO", 3000, "Lazer"),
      m("2026-02-09", "GINASIO", 3000, "Lazer"),
      m("2026-02-14", "GINASIO", 3000, "Lazer"),
      m("2026-05-15", "GINASIO", 3000, "Lazer"),
    ];
    expect(detetarSubscricoes(irregular)).toHaveLength(0);
  });

  it("precisa de pelo menos três cobranças", () => {
    expect(
      detetarSubscricoes([
        m("2026-06-10", "SPOTIFY", 999),
        m("2026-07-10", "SPOTIFY", 999),
      ]),
    ).toHaveLength(0);
  });

  it("nota quando o preço subiu", () => {
    const subs = detetarSubscricoes([
      m("2026-05-10", "SPOTIFY", 999, "Subscrições"),
      m("2026-06-10", "SPOTIFY", 999, "Subscrições"),
      m("2026-07-10", "SPOTIFY", 1199, "Subscrições"),
    ]);
    expect(subs[0].subiuCents).toBe(200);
  });

  it("ignora receitas — não há subscrições que paguem a quem as tem", () => {
    expect(
      detetarSubscricoes([
        m("2026-05-10", "ORDENADO", -92000, "Ordenado"),
        m("2026-06-10", "ORDENADO", -92000, "Ordenado"),
        m("2026-07-10", "ORDENADO", -92000, "Ordenado"),
      ]),
    ).toHaveLength(0);
  });
});

describe("anomalias", () => {
  const habituais = Array.from({ length: 8 }, (_, i) =>
    m(`2026-06-0${i + 1}`, "SUPERMERCADO", 3000, "Supermercado"),
  );

  it("apanha uma despesa muito acima do costume", () => {
    const anomalias = detetarAnomalias(
      [...habituais, m("2026-07-15", "SUPERMERCADO", 15000, "Supermercado")],
      "2026-07-01",
    );
    expect(anomalias).toHaveLength(1);
    expect(anomalias[0].vezes).toBeGreaterThanOrEqual(3);
    expect(anomalias[0].habitualCents).toBe(3000);
  });

  it("não se queixa de uma variação pequena em valores pequenos", () => {
    // Um café de €3 quando o costume é €1 é 3× — mas são 2 euros.
    const cafes = Array.from({ length: 8 }, (_, i) =>
      m(`2026-06-0${i + 1}`, "CAFE", 100, "Lazer"),
    );
    const anomalias = detetarAnomalias(
      [...cafes, m("2026-07-15", "CAFE", 300, "Lazer")],
      "2026-07-01",
    );
    expect(anomalias).toHaveLength(0);
  });

  it("não julga sem exemplos suficientes", () => {
    const anomalias = detetarAnomalias(
      [
        m("2026-06-01", "X", 1000, "Nova"),
        m("2026-07-15", "X", 90000, "Nova"),
      ],
      "2026-07-01",
    );
    expect(anomalias).toHaveLength(0);
  });

  it("usa a mediana e não a média", () => {
    // Com um valor extremo antigo, a média sobe e esconderia o novo.
    // 7 × 1000 + 1 × 100000 → média 13375, mediana 1000.
    const base = [
      ...Array.from({ length: 7 }, (_, i) =>
        m(`2026-06-0${i + 1}`, "Y", 1000, "Casa"),
      ),
      m("2026-06-08", "Y", 100_000, "Casa"),
    ];
    const anomalias = detetarAnomalias(
      [...base, m("2026-07-15", "Y", 8000, "Casa")],
      "2026-07-01",
    );
    expect(anomalias).toHaveLength(1);
    expect(anomalias[0].habitualCents).toBe(1000);
  });

  it("só olha para o período recente", () => {
    expect(
      detetarAnomalias(
        [...habituais, m("2026-01-15", "SUPERMERCADO", 15000, "Supermercado")],
        "2026-07-01",
      ),
    ).toHaveLength(0);
  });
});

describe("fundo de emergência", () => {
  it("diz quantos meses aguenta", () => {
    const f = fundoDeEmergencia(300_000, 100_000);
    expect(f.meses).toBe(3);
    expect(f.nivel).toBe("razoável");
    expect(f.faltamPara3Cents).toBe(0);
    expect(f.faltamPara6Cents).toBe(300_000);
  });

  it("não inventa quando não há gastos registados", () => {
    const f = fundoDeEmergencia(500_000, 0);
    expect(f.meses).toBeNull();
  });

  it("classifica honestamente quem não tem rede", () => {
    expect(fundoDeEmergencia(20_000, 100_000).nivel).toBe("sem-rede");
    expect(fundoDeEmergencia(150_000, 100_000).nivel).toBe("frágil");
    expect(fundoDeEmergencia(700_000, 100_000).nivel).toBe("confortável");
  });

  it("saldo negativo não dá meses positivos", () => {
    expect(fundoDeEmergencia(-50_000, 100_000).meses).toBeLessThan(0);
  });
});

describe("50/30/20", () => {
  it("separa necessidades de desejos", () => {
    const r = repartir(200_000, [
      { nome: "Renda", cents: 70_000 },
      { nome: "Supermercado", cents: 30_000 },
      { nome: "Lazer", cents: 20_000 },
      { nome: "Compras", cents: 10_000 },
    ])!;
    expect(r.necessidadesCents).toBe(100_000);
    expect(r.desejosCents).toBe(30_000);
    expect(r.sobrouCents).toBe(70_000);
    expect(r.necessidadesPercent).toBe(50);
  });

  it("apanha acentos nas categorias", () => {
    const r = repartir(100_000, [
      { nome: "Alimentação", cents: 20_000 },
      { nome: "Saúde", cents: 10_000 },
      { nome: "Água", cents: 5_000 },
    ])!;
    expect(r.necessidadesCents).toBe(35_000);
    expect(r.desejosCents).toBe(0);
  });

  it("não finge que a regra se aplica a quem gasta mais do que recebe", () => {
    const r = repartir(100_000, [{ nome: "Renda", cents: 150_000 }])!;
    expect(r.sobrouCents).toBeLessThan(0);
    expect(r.comentario).toMatch(/mais do que recebe/i);
  });

  it("aponta o problema certo quando as fixas são esmagadoras", () => {
    const r = repartir(100_000, [{ nome: "Renda", cents: 75_000 }])!;
    expect(r.comentario).toMatch(/uma das grandes/i);
  });

  it("sem rendimento não há repartição nenhuma", () => {
    expect(repartir(0, [{ nome: "Renda", cents: 100 }])).toBeNull();
  });
});
