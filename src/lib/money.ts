/**
 * Aritmética de dinheiro. Este é o ÚNICO sítio do projeto onde se soma,
 * multiplica ou arredonda dinheiro.
 *
 * Regra: tudo em cêntimos inteiros. Nunca `float`.
 *
 *   0.1 + 0.2 === 0.30000000000000004      ← inaceitável em dinheiro
 *   10 + 20 === 30                          ← cêntimos, sempre exato
 *
 * As taxas (€/km, €/litro) entram como inteiros escalados e o arredondamento
 * acontece UMA só vez, no fim de cada cálculo.
 */

/** Cêntimos. €920,00 → 92000. */
export type Cents = number;

/** Metros. 150,0 km → 150000. */
export type Metres = number;

const MAX_CENTS = 2_147_483_647; // limite do Int do Postgres → €21 474 836,47

export class MoneyError extends Error {}

/**
 * Divisão inteira com arredondamento "half away from zero" (0,5 → 1;
 * −0,5 → −1). É o arredondamento que as pessoas esperam ao ver dinheiro.
 */
export function divRound(numerator: number, denominator: number): number {
  if (denominator === 0) throw new MoneyError("Divisão por zero");
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    throw new MoneyError("Valor não finito");
  }
  const sign = Math.sign(numerator) * Math.sign(denominator) || 1;
  const abs = Math.abs(numerator);
  const absD = Math.abs(denominator);
  return sign * Math.floor((abs + absD / 2) / absD);
}

/** Soma segura. Rejeita valores não inteiros e deteta transbordo. */
export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (const v of values) {
    assertCents(v);
    total += v;
  }
  assertCents(total);
  return total;
}

export function assertCents(value: unknown): asserts value is Cents {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new MoneyError(`Valor monetário inválido: ${String(value)}`);
  }
  if (Math.abs(value) > MAX_CENTS) {
    throw new MoneyError(
      `Valor fora dos limites suportados (máx. ${formatCents(MAX_CENTS)})`,
    );
  }
}

/**
 * Lê o que a pessoa escreveu num campo de valor.
 * Aceita "920", "920,50", "920.50", "1.234,56", "1,234.56", "-15", "€12,40".
 * Devolve `null` se não for um número válido.
 */
export function parseAmountToCents(raw: string): Cents | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim().replace(/[€\s ]/g, "");
  if (s === "") return null;

  const negative = s.startsWith("-");
  if (negative || s.startsWith("+")) s = s.slice(1);
  if (!/^[\d.,]+$/.test(s)) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let decimalSep = "";
  if (lastComma !== -1 && lastDot !== -1) {
    // O separador decimal é o que aparece mais à direita.
    decimalSep = lastComma > lastDot ? "," : ".";
  } else if (lastComma !== -1) {
    // "1,234" é ambíguo: com 3 dígitos à direita tratamos como milhares.
    decimalSep = s.length - lastComma - 1 === 3 ? "" : ",";
  } else if (lastDot !== -1) {
    decimalSep = s.length - lastDot - 1 === 3 ? "" : ".";
  }

  let integerPart = s;
  let decimalPart = "";
  if (decimalSep) {
    const idx = s.lastIndexOf(decimalSep);
    integerPart = s.slice(0, idx);
    decimalPart = s.slice(idx + 1);
  }

  integerPart = integerPart.replace(/[.,]/g, "");
  if (decimalPart.includes(".") || decimalPart.includes(",")) return null;
  if (decimalPart.length > 2) return null;
  if (integerPart === "" && decimalPart === "") return null;
  if (integerPart !== "" && !/^\d+$/.test(integerPart)) return null;
  if (decimalPart !== "" && !/^\d+$/.test(decimalPart)) return null;

  const euros = integerPart === "" ? 0 : Number(integerPart);
  const cents = decimalPart === "" ? 0 : Number(decimalPart.padEnd(2, "0"));
  const total = euros * 100 + cents;
  if (!Number.isSafeInteger(total) || Math.abs(total) > MAX_CENTS) return null;
  return negative ? -total : total;
}

const eurFormatter = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const eurNoSymbol = new Intl.NumberFormat("pt-PT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** €920,00 */
export function formatCents(cents: Cents): string {
  return eurFormatter.format(cents / 100);
}

/** 920,00 — sem símbolo, para dentro de campos de formulário. */
export function centsToInput(cents: Cents): string {
  return eurNoSymbol.format(cents / 100).replace(/ /g, "");
}

/** +920,00 € / −45,10 € — com sinal explícito, para variações. */
export function formatCentsSigned(cents: Cents): string {
  const s = formatCents(Math.abs(cents));
  if (cents > 0) return `+${s}`;
  if (cents < 0) return `−${s}`;
  return s;
}

/** 1,2 k€ para eixos de gráficos, onde não cabe o valor inteiro. */
export function formatCentsShort(cents: Cents): string {
  const euros = cents / 100;
  const abs = Math.abs(euros);
  if (abs >= 1000) {
    return `${(euros / 1000).toLocaleString("pt-PT", {
      maximumFractionDigits: 1,
    })} k€`;
  }
  return `${euros.toLocaleString("pt-PT", { maximumFractionDigits: 0 })} €`;
}

// ─── Conversões de unidades ────────────────────────────────────────────────

/** 150000 m → "150" (km, sem casas desnecessárias) */
export function metresToKmString(metres: Metres, decimals = 1): string {
  return (metres / 1000).toLocaleString("pt-PT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function parseKmToMetres(raw: string): Metres | null {
  const s = raw.trim().replace(/[\s ]/g, "").replace(",", ".");
  if (s === "" || !/^\d+(\.\d{1,3})?$/.test(s)) return null;
  const metres = Math.round(Number(s) * 1000);
  return Number.isSafeInteger(metres) ? metres : null;
}

/**
 * Receita de um trabalho pago ao quilómetro.
 *
 *   150 km × €0,40/km  →  divRound(150000 × 40, 1000)  =  6000 cêntimos
 *
 * Aritmética inteira do princípio ao fim: 150 × 0,40 dá exatamente €60,00,
 * nunca €59,99 nem €60,01.
 */
export function kmPayToCents(metres: Metres, ratePerKmCents: number): Cents {
  if (!Number.isInteger(metres) || !Number.isInteger(ratePerKmCents)) {
    throw new MoneyError("Distância e taxa têm de ser inteiros");
  }
  return divRound(metres * ratePerKmCents, 1000);
}

/**
 * Custo de um abastecimento.
 *   litros(ml) × preço(€/L × 10⁴) ÷ 10⁵  →  cêntimos
 *   40 L a €1,689/L → 40000 × 16890 ÷ 100000 = 6756 → €67,56
 */
export function fuelTotalCents(litersMl: number, pricePerLiterE4: number): Cents {
  if (!Number.isInteger(litersMl) || !Number.isInteger(pricePerLiterE4)) {
    throw new MoneyError("Litros e preço têm de ser inteiros");
  }
  return divRound(litersMl * pricePerLiterE4, 100_000);
}

/** Consumo em litros por 100 km, com uma casa decimal. `null` se não houver km. */
export function consumptionPer100Km(
  litersMl: number,
  metres: Metres,
): number | null {
  if (metres <= 0) return null;
  return Math.round((litersMl / 1000 / (metres / 1000)) * 100 * 10) / 10;
}

/**
 * Custo por quilómetro, em cêntimos por km.
 * Devolve `null` quando não há quilómetros — não se inventa um número.
 */
export function costPerKmCents(totalCents: Cents, metres: Metres): number | null {
  if (metres <= 0) return null;
  return divRound(totalCents * 1000, metres);
}

/** "0,082 €/km" a partir de cêntimos por km (que pode ter fração). */
export function formatCostPerKm(centsPerKm: number): string {
  return `${(centsPerKm / 100).toLocaleString("pt-PT", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} €/km`;
}

/** Percentagem inteira e limitada, para barras de progresso. */
export function percentOf(part: Cents, whole: Cents): number {
  if (whole === 0) return 0;
  return Math.round((part / whole) * 100);
}
