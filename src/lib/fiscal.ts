/**
 * O dinheiro que está na conta e NÃO é seu.
 *
 * Quem trabalha a recibos verdes fatura €2 000, vê €2 000 na conta, gasta
 * €2 000 — e em janeiro chega a nota da Segurança Social. Não é falta de
 * disciplina: é que o extrato mente. O saldo mostra dinheiro que já tem dono.
 *
 * Este módulo separa esse dinheiro. É puro: entra um valor faturado e um
 * perfil, sai quanto guardar e porquê.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ISTO NÃO É ACONSELHAMENTO FISCAL.
 *
 * São estimativas com as regras públicas de 2026. Todas as taxas estão neste
 * ficheiro, com a data e a fonte, e TODAS são editáveis no perfil de cada
 * pessoa — porque mudam todos os anos e porque há exceções que nenhuma app
 * consegue adivinhar. A app mostra sempre a conta que fez.
 * ───────────────────────────────────────────────────────────────────────────
 */

import type { Cents } from "@/lib/money";
import { divRound } from "@/lib/money";

/**
 * Taxas em vigor. Um só sítio, com a data ao lado.
 *
 * Fontes (agosto de 2026): Guia Fiscal 2026 da PwC Portugal, Segurança Social
 * (regime dos trabalhadores independentes), Código do IVA art. 53.º,
 * Código do IRS art. 101.º e 151.º.
 */
export const TAXAS = {
  atualizadoEm: "2026-08-16",

  segurancaSocial: {
    /** 21,4% sobre o rendimento relevante. */
    taxa: 0.214,
    /** O rendimento relevante é 70% do faturado em prestação de serviços. */
    coeficienteServicos: 0.7,
    /** Paga-se em janeiro, abril, julho e outubro. */
    mesesDePagamento: [1, 4, 7, 10] as const,
    /** Mínimo mensal, mesmo sem faturar nada. */
    minimoMensalCents: 2000,
    /** Teto: 12 × IAS em 2026. */
    tetoMensalRelevanteCents: 644_556,
    /** Isenção total nos primeiros 12 meses de atividade. */
    mesesIsencaoInicio: 12,
  },

  iva: {
    /** Taxa normal no continente. */
    normal: 0.23,
    /** Abaixo deste volume de negócios anual há isenção pelo art. 53.º. */
    limiteIsencaoArt53Cents: 1_350_000,
  },

  irs: {
    /**
     * Taxa geral de retenção na fonte da categoria B (art. 101.º). Há casos
     * a 16,5%, 11,5% e 20% — por isso é editável.
     */
    retencaoGeral: 0.23,
    /** Dispensa de retenção se o ano anterior não passou deste valor. */
    limiteDispensaRetencaoCents: 1_500_000,
    /**
     * Quanto guardar para o acerto anual quando NÃO há retenção na fonte.
     * É um palpite prudente, não uma conta: o IRS real depende do agregado,
     * das deduções e do escalão. A app diz isto sempre que mostra o número.
     */
    reservaSugerida: 0.2,
  },
} as const;

export type RegimeIva = "ISENTO_ART53" | "NORMAL";

export type PerfilFiscal = {
  /** Trabalha a recibos verdes? Se não, nada disto se aplica. */
  independente: boolean;
  regimeIva: RegimeIva;
  /** O cliente retém IRS no recibo? Se retém, esse dinheiro nunca chega. */
  retencaoNaFonte: boolean;
  /** Mês em que abriu atividade, "YYYY-MM". Para a isenção dos 12 meses. */
  inicioAtividade: string | null;
  /** Todas as taxas podem ser ajustadas — ver o cabeçalho deste ficheiro. */
  taxaSsPercent: number;
  coeficienteSsPercent: number;
  taxaIvaPercent: number;
  taxaRetencaoPercent: number;
  reservaIrsPercent: number;
};

export const PERFIL_OMISSAO: PerfilFiscal = {
  independente: false,
  regimeIva: "ISENTO_ART53",
  retencaoNaFonte: false,
  inicioAtividade: null,
  taxaSsPercent: TAXAS.segurancaSocial.taxa * 100,
  coeficienteSsPercent: TAXAS.segurancaSocial.coeficienteServicos * 100,
  taxaIvaPercent: TAXAS.iva.normal * 100,
  taxaRetencaoPercent: TAXAS.irs.retencaoGeral * 100,
  reservaIrsPercent: TAXAS.irs.reservaSugerida * 100,
};

/** Uma parcela do que há a guardar, com a conta à vista. */
export type Parcela = {
  chave: "IVA" | "SS" | "IRS";
  titulo: string;
  cents: Cents;
  /** A conta, em português, para a pessoa poder verificar. */
  conta: string;
  /** Quando se paga. */
  quando: string;
};

export type Reserva = {
  /** O que foi faturado, sem IVA. */
  baseCents: Cents;
  /** O que entrou mesmo na conta. */
  recebidoCents: Cents;
  parcelas: Parcela[];
  /** Soma das parcelas: o dinheiro que está na conta e não é seu. */
  guardarCents: Cents;
  /** O que sobra e é mesmo seu. */
  seuCents: Cents;
  avisos: string[];
};

function pct(cents: Cents, percent: number): Cents {
  return divRound(cents * Math.round(percent * 100), 10_000);
}

/** "5" → "5%", "21.4" → "21,4%" */
export function formatPercent(value: number): string {
  return `${value.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}%`;
}

/**
 * Quantos meses passaram desde a abertura de atividade.
 * `null` quando não se sabe — e então não se promete isenção nenhuma.
 */
export function mesesDeAtividade(
  inicio: string | null,
  hoje: string,
): number | null {
  if (!inicio || !/^\d{4}-\d{2}$/.test(inicio)) return null;
  const [ai, mi] = inicio.split("-").map(Number);
  const [ah, mh] = hoje.slice(0, 7).split("-").map(Number);
  return (ah - ai) * 12 + (mh - mi);
}

export function isentoDeSegurancaSocial(
  perfil: PerfilFiscal,
  hoje: string,
): boolean {
  const meses = mesesDeAtividade(perfil.inicioAtividade, hoje);
  if (meses === null) return false;
  return meses >= 0 && meses < TAXAS.segurancaSocial.mesesIsencaoInicio;
}

/**
 * Quanto guardar de um recibo.
 *
 * `baseCents` é o valor do serviço, SEM IVA — é sobre ele que tudo se calcula.
 * Se a pessoa não é isenta, ao valor do serviço somou-se IVA e o cliente
 * pagou os dois; esse IVA entra na conta e é do Estado, não dela.
 */
export function calcularReserva(
  baseCents: Cents,
  perfil: PerfilFiscal,
  hoje: string,
): Reserva {
  const parcelas: Parcela[] = [];
  const avisos: string[] = [];

  if (!perfil.independente || baseCents <= 0) {
    return {
      baseCents,
      recebidoCents: baseCents,
      parcelas: [],
      guardarCents: 0,
      seuCents: baseCents,
      avisos: [],
    };
  }

  // ── IVA ──────────────────────────────────────────────────────────────────
  // Cobrado por cima do serviço. Entra na conta e sai para o Estado.
  let ivaCents = 0;
  if (perfil.regimeIva === "NORMAL") {
    ivaCents = pct(baseCents, perfil.taxaIvaPercent);
    parcelas.push({
      chave: "IVA",
      titulo: "IVA",
      cents: ivaCents,
      conta: `${formatPercent(perfil.taxaIvaPercent)} de ${euros(baseCents)}`,
      quando: "Entrega trimestral ou mensal, conforme o seu regime",
    });
  }

  // ── Segurança Social ─────────────────────────────────────────────────────
  // 21,4% sobre 70% do faturado — dá 14,98% do que faturou. Não é sobre o IVA.
  if (isentoDeSegurancaSocial(perfil, hoje)) {
    const meses = mesesDeAtividade(perfil.inicioAtividade, hoje)!;
    const faltam = TAXAS.segurancaSocial.mesesIsencaoInicio - meses;
    avisos.push(
      `Está isento de Segurança Social nos primeiros 12 meses de atividade. ` +
        `${faltam === 1 ? "Falta 1 mês" : `Faltam ${faltam} meses`} — a partir daí ` +
        `passa a guardar cerca de ${formatPercent(
          (perfil.taxaSsPercent * perfil.coeficienteSsPercent) / 100,
        )} de tudo o que faturar.`,
    );
  } else {
    const relevante = pct(baseCents, perfil.coeficienteSsPercent);
    const ssCents = pct(relevante, perfil.taxaSsPercent);
    parcelas.push({
      chave: "SS",
      titulo: "Segurança Social",
      cents: ssCents,
      conta:
        `${formatPercent(perfil.taxaSsPercent)} de ${euros(relevante)} ` +
        `(que é ${formatPercent(perfil.coeficienteSsPercent)} de ${euros(baseCents)})`,
      quando: "Trimestral: janeiro, abril, julho e outubro",
    });
  }

  // ── IRS ──────────────────────────────────────────────────────────────────
  // Se o cliente retém, o dinheiro nunca chega — não há nada a guardar.
  // Se não retém, o acerto vem no ano seguinte e apanha muita gente.
  if (perfil.retencaoNaFonte) {
    avisos.push(
      `O IRS é retido pelo cliente (${formatPercent(perfil.taxaRetencaoPercent)}), ` +
        `por isso esse dinheiro nem chega à sua conta. Não precisa de o guardar — ` +
        `mas conte com ele quando comparar o que faturou com o que recebeu.`,
    );
  } else {
    const irsCents = pct(baseCents, perfil.reservaIrsPercent);
    parcelas.push({
      chave: "IRS",
      titulo: "IRS (estimativa)",
      cents: irsCents,
      conta: `${formatPercent(perfil.reservaIrsPercent)} de ${euros(baseCents)}`,
      quando: "Acerto na declaração anual, entregue entre abril e junho",
    });
    avisos.push(
      "A parcela do IRS é uma estimativa prudente, não uma conta exata: o valor " +
        "real depende do seu agregado, das deduções e do escalão. Ajuste a " +
        "percentagem no perfil se souber melhor.",
    );
  }

  const guardarCents = parcelas.reduce((s, p) => s + p.cents, 0);
  const recebidoCents = baseCents + ivaCents;

  return {
    baseCents,
    recebidoCents,
    parcelas,
    guardarCents,
    seuCents: recebidoCents - guardarCents,
    avisos,
  };
}

function euros(cents: Cents): string {
  return `${(cents / 100).toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

// ─── Calendário ────────────────────────────────────────────────────────────

export type Obrigacao = {
  titulo: string;
  data: string;
  descricao: string;
  /** Trimestre a que diz respeito, quando aplicável. */
  periodo?: string;
};

/**
 * As datas que apanham toda a gente de surpresa.
 *
 * A Segurança Social paga-se de 1 a 20 do mês seguinte ao fim do trimestre.
 * A declaração trimestral entrega-se até ao fim do mês.
 */
export function calendarioFiscal(
  perfil: PerfilFiscal,
  hoje: string,
): Obrigacao[] {
  if (!perfil.independente) return [];

  const ano = Number(hoje.slice(0, 4));
  const obrigacoes: Obrigacao[] = [];

  const trimestres = [
    { meses: "outubro a dezembro", mesPagamento: 1, anoOffset: 0, doAno: ano - 1 },
    { meses: "janeiro a março", mesPagamento: 4, anoOffset: 0, doAno: ano },
    { meses: "abril a junho", mesPagamento: 7, anoOffset: 0, doAno: ano },
    { meses: "julho a setembro", mesPagamento: 10, anoOffset: 0, doAno: ano },
  ];

  for (const t of trimestres) {
    const mm = String(t.mesPagamento).padStart(2, "0");
    obrigacoes.push({
      titulo: "Declaração trimestral e contribuição",
      data: `${ano + t.anoOffset}-${mm}-20`,
      descricao:
        "Declarar o que faturou no trimestre e pagar a contribuição para a " +
        "Segurança Social. Paga-se entre o dia 1 e o dia 20.",
      periodo: `${t.meses} de ${t.doAno}`,
    });
  }

  if (perfil.regimeIva === "NORMAL") {
    for (const mes of [2, 5, 8, 11]) {
      const mm = String(mes).padStart(2, "0");
      obrigacoes.push({
        titulo: "Declaração periódica de IVA",
        data: `${ano}-${mm}-20`,
        descricao:
          "Entregar a declaração de IVA do trimestre anterior e pagar o que " +
          "cobrou aos clientes.",
      });
    }
  }

  obrigacoes.push({
    titulo: "Declaração de IRS",
    data: `${ano}-06-30`,
    descricao:
      `Entrega da declaração de rendimentos de ${ano - 1}, entre 1 de abril e ` +
      "30 de junho.",
  });

  return obrigacoes
    .filter((o) => o.data >= hoje)
    .sort((a, b) => a.data.localeCompare(b.data));
}

/**
 * Projeção do volume de negócios, para avisar antes de o limite do IVA ser
 * ultrapassado — e não depois, quando já não há nada a fazer.
 */
export function projecaoIva(
  faturadoNoAnoCents: Cents,
  mesesDecorridos: number,
): { projecaoCents: Cents; percentagemDoLimite: number; vaiUltrapassar: boolean } {
  const meses = Math.max(1, Math.min(12, mesesDecorridos));
  const projecaoCents = divRound(faturadoNoAnoCents * 12, meses);
  const limite = TAXAS.iva.limiteIsencaoArt53Cents;
  return {
    projecaoCents,
    percentagemDoLimite: Math.round((faturadoNoAnoCents / limite) * 100),
    vaiUltrapassar: projecaoCents > limite,
  };
}
