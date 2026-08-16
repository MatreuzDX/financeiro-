/**
 * Liga o motor fiscal (`src/lib/fiscal.ts`) aos números reais da pessoa.
 *
 * O módulo puro sabe fazer as contas; este sabe onde estão os valores. A
 * separação existe porque as contas de impostos têm de ser testáveis sem base
 * de dados — e são, com 25 testes.
 */

import "server-only";
import { z } from "zod";
import { prisma } from "@/server/db";
import {
  calcularReserva,
  calendarioFiscal,
  isentoDeSegurancaSocial,
  PERFIL_OMISSAO,
  projecaoIva,
  TAXAS,
  type Obrigacao,
  type PerfilFiscal,
  type Reserva,
} from "@/lib/fiscal";
import { negate } from "@/lib/money";
import { startOfYear, todayIso } from "@/lib/date";
import type { SessionUser } from "@/server/auth/session";

/** As taxas guardam-se em centésimos de ponto: 2140 → 21,4. */
const paraPercent = (guardado: number) => guardado / 100;
const paraGuardado = (percent: number) => Math.round(percent * 100);

export async function lerPerfilFiscal(workspaceId: string): Promise<PerfilFiscal> {
  const linha = await prisma.fiscalProfile.findUnique({ where: { workspaceId } });
  if (!linha) return PERFIL_OMISSAO;

  return {
    independente: linha.independente,
    regimeIva: linha.regimeIva === "NORMAL" ? "NORMAL" : "ISENTO_ART53",
    retencaoNaFonte: linha.retencaoNaFonte,
    inicioAtividade: linha.inicioAtividade,
    taxaSsPercent: paraPercent(linha.taxaSs),
    coeficienteSsPercent: paraPercent(linha.coeficienteSs),
    taxaIvaPercent: paraPercent(linha.taxaIva),
    taxaRetencaoPercent: paraPercent(linha.taxaRetencao),
    reservaIrsPercent: paraPercent(linha.reservaIrs),
  };
}

const perfilInput = z.object({
  independente: z.boolean(),
  regimeIva: z.enum(["ISENTO_ART53", "NORMAL"]),
  retencaoNaFonte: z.boolean(),
  inicioAtividade: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Escreva o mês no formato AAAA-MM")
    .nullable()
    .or(z.literal("").transform(() => null)),
  taxaSsPercent: z.number().min(0).max(100),
  coeficienteSsPercent: z.number().min(0).max(100),
  taxaIvaPercent: z.number().min(0).max(100),
  taxaRetencaoPercent: z.number().min(0).max(100),
  reservaIrsPercent: z.number().min(0).max(100),
});

export async function guardarPerfilFiscal(
  session: SessionUser,
  raw: unknown,
): Promise<void> {
  const input = perfilInput.parse(raw);
  const dados = {
    independente: input.independente,
    regimeIva: input.regimeIva,
    retencaoNaFonte: input.retencaoNaFonte,
    inicioAtividade: input.inicioAtividade,
    taxaSs: paraGuardado(input.taxaSsPercent),
    coeficienteSs: paraGuardado(input.coeficienteSsPercent),
    taxaIva: paraGuardado(input.taxaIvaPercent),
    taxaRetencao: paraGuardado(input.taxaRetencaoPercent),
    reservaIrs: paraGuardado(input.reservaIrsPercent),
  };

  await prisma.fiscalProfile.upsert({
    where: { workspaceId: session.workspaceId },
    create: { workspaceId: session.workspaceId, ...dados },
    update: dados,
  });
}

// ─── O panorama ────────────────────────────────────────────────────────────

export type PanoramaFiscal = {
  perfil: PerfilFiscal;
  /** Receita profissional do ano, sem IVA. É a base de tudo. */
  faturadoAnoCents: number;
  faturadoTrimestreCents: number;
  reservaAno: Reserva;
  reservaTrimestre: Reserva;
  saldoTotalCents: number;
  /** O que sobra do saldo depois de tirar o que é do Estado. */
  mesmoSeuCents: number;
  iva: ReturnType<typeof projecaoIva>;
  isentoSs: boolean;
  calendario: Obrigacao[];
  trimestreLabel: string;
};

/**
 * A receita profissional do período.
 *
 * Só conta o âmbito PROFISSIONAL: o dinheiro pessoal — um reembolso, uma
 * prenda, a venda de um telemóvel usado — não gera imposto de atividade e
 * incluí-lo faria a app pedir para guardar dinheiro a mais.
 */
async function faturado(
  workspaceId: string,
  from: string,
  to: string,
): Promise<number> {
  const agg = await prisma.entry.aggregate({
    _sum: { amountCents: true },
    where: {
      workspaceId,
      category: { type: "INCOME" },
      transaction: {
        deletedAt: null,
        status: "CLEARED",
        scope: "BUSINESS",
        date: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T00:00:00.000Z`) },
      },
    },
  });
  return negate(agg._sum.amountCents ?? 0);
}

function trimestreDe(hoje: string): { from: string; to: string; label: string } {
  const ano = hoje.slice(0, 4);
  const mes = Number(hoje.slice(5, 7));
  const indice = Math.floor((mes - 1) / 3);
  const inicio = indice * 3 + 1;
  const fim = inicio + 2;
  const ultimoDia = new Date(Date.UTC(Number(ano), fim, 0)).getUTCDate();
  const nomes = ["janeiro a março", "abril a junho", "julho a setembro", "outubro a dezembro"];
  return {
    from: `${ano}-${String(inicio).padStart(2, "0")}-01`,
    to: `${ano}-${String(fim).padStart(2, "0")}-${ultimoDia}`,
    label: nomes[indice],
  };
}

export async function panoramaFiscal(
  workspaceId: string,
  timezone: string,
): Promise<PanoramaFiscal> {
  const hoje = todayIso(timezone);
  const perfil = await lerPerfilFiscal(workspaceId);
  const trimestre = trimestreDe(hoje);

  const [faturadoAnoCents, faturadoTrimestreCents, saldo] = await Promise.all([
    faturado(workspaceId, startOfYear(hoje), hoje),
    faturado(workspaceId, trimestre.from, hoje < trimestre.to ? hoje : trimestre.to),
    prisma.account.aggregate({
      _sum: { cachedBalanceCents: true },
      where: { workspaceId, archived: false },
    }),
  ]);

  const saldoTotalCents = saldo._sum.cachedBalanceCents ?? 0;
  const reservaAno = calcularReserva(faturadoAnoCents, perfil, hoje);
  const reservaTrimestre = calcularReserva(faturadoTrimestreCents, perfil, hoje);

  return {
    perfil,
    faturadoAnoCents,
    faturadoTrimestreCents,
    reservaAno,
    reservaTrimestre,
    saldoTotalCents,
    // Nunca abaixo de zero: dizer "-€300 são seus" não ajuda ninguém.
    mesmoSeuCents: Math.max(0, saldoTotalCents - reservaAno.guardarCents),
    iva: projecaoIva(faturadoAnoCents, Number(hoje.slice(5, 7))),
    isentoSs: isentoDeSegurancaSocial(perfil, hoje),
    calendario: calendarioFiscal(perfil, hoje).slice(0, 4),
    trimestreLabel: trimestre.label,
  };
}

export { TAXAS };
