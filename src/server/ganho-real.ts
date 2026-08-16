/**
 * Quanto ganha MESMO por hora.
 *
 * Os dados do setor são brutais: motoristas que anunciam 25 €/h estão a
 * ganhar 10 a 15 €/h depois do combustível, do desgaste do veículo e dos
 * impostos. E estima-se que quem faz entregas deixe 1 500 a 3 000 € por ano
 * em cima da mesa por não registar os custos.
 *
 * Esta app já tinha as peças todas — os trabalhos, as horas, os quilómetros,
 * os abastecimentos, os custos do veículo, o motor fiscal — e nunca tinha
 * feito a divisão. É só isso que este ficheiro faz.
 *
 * REGRA: sem horas registadas não se inventa um ganho por hora. Devolve-se
 * `null` e diz-se que faltam horas, como em todo o resto da app.
 */

import "server-only";
import { prisma } from "@/server/db";
import { calcularReserva } from "@/lib/fiscal";
import { lerPerfilFiscal } from "@/server/fiscal";
import { divRound } from "@/lib/money";
import { fromIso, todayIso, type IsoDate } from "@/lib/date";

export type GanhoReal = {
  /** O que os trabalhos renderam, antes de qualquer desconto. */
  brutoCents: number;
  horasDecimos: number;
  metros: number;
  /** Combustível, manutenção, seguro… lançados contra um veículo. */
  custosVeiculoCents: number;
  /** IVA + Segurança Social + IRS sobre esta receita. */
  impostosCents: number;
  /** Bruto menos custos menos impostos. É este o número. */
  liquidoCents: number;
  /** `null` sem horas registadas — não se inventa. */
  brutoPorHoraCents: number | null;
  liquidoPorHoraCents: number | null;
  /** Quanto do bruto se evapora, em percentagem. */
  percentagemPerdida: number | null;
  liquidoPorKmCents: number | null;
  trabalhos: number;
};

export type PorDiaDaSemana = {
  dia: string;
  trabalhos: number;
  brutoCents: number;
  horasDecimos: number;
  brutoPorHoraCents: number | null;
};

const DIAS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

export async function ganhoReal(
  workspaceId: string,
  timezone: string,
  range: { from: IsoDate; to: IsoDate },
): Promise<GanhoReal> {
  const hoje = todayIso(timezone);
  const janela = { gte: fromIso(range.from), lte: fromIso(range.to) };

  const [trabalhos, custos, perfil] = await Promise.all([
    prisma.workJob.findMany({
      where: { workspaceId, date: janela },
      select: { grossCents: true, hoursTenths: true, distanceMetres: true },
    }),
    // Só despesas ligadas a um veículo: a renda de casa não é custo de
    // trabalhar, e metê-la aqui daria um ganho por hora falsamente mau.
    prisma.entry.aggregate({
      _sum: { amountCents: true },
      where: {
        workspaceId,
        category: { type: "EXPENSE" },
        transaction: {
          deletedAt: null,
          status: "CLEARED",
          vehicleId: { not: null },
          date: janela,
        },
      },
    }),
    lerPerfilFiscal(workspaceId),
  ]);

  const brutoCents = trabalhos.reduce((s, t) => s + t.grossCents, 0);
  const horasDecimos = trabalhos.reduce((s, t) => s + t.hoursTenths, 0);
  const metros = trabalhos.reduce((s, t) => s + t.distanceMetres, 0);
  const custosVeiculoCents = custos._sum.amountCents ?? 0;

  const impostosCents = calcularReserva(brutoCents, perfil, hoje).guardarCents;
  const liquidoCents = brutoCents - custosVeiculoCents - impostosCents;

  const temHoras = horasDecimos > 0;
  return {
    brutoCents,
    horasDecimos,
    metros,
    custosVeiculoCents,
    impostosCents,
    liquidoCents,
    brutoPorHoraCents: temHoras ? divRound(brutoCents * 10, horasDecimos) : null,
    liquidoPorHoraCents: temHoras ? divRound(liquidoCents * 10, horasDecimos) : null,
    percentagemPerdida:
      brutoCents > 0
        ? Math.round(((brutoCents - liquidoCents) / brutoCents) * 100)
        : null,
    liquidoPorKmCents: metros > 0 ? divRound(liquidoCents * 1000, metros) : null,
    trabalhos: trabalhos.length,
  };
}

/**
 * Onde está o dinheiro que já se está a ganhar.
 *
 * Só por dia da semana: a app regista a DATA de um trabalho, não a hora a que
 * começou. Comparar manhã com noite exigiria um campo que não existe, e
 * inventá-lo a partir do `createdAt` daria uma resposta errada com ar de
 * certa — quem regista tudo à noite veria "as noites rendem mais".
 */
export async function porDiaDaSemana(
  workspaceId: string,
  range: { from: IsoDate; to: IsoDate },
): Promise<PorDiaDaSemana[]> {
  const trabalhos = await prisma.workJob.findMany({
    where: {
      workspaceId,
      date: { gte: fromIso(range.from), lte: fromIso(range.to) },
    },
    select: { date: true, grossCents: true, hoursTenths: true },
  });

  const porDia = new Map<number, { bruto: number; horas: number; n: number }>();
  for (const t of trabalhos) {
    // getUTCDay porque as datas são @db.Date guardadas à meia-noite UTC.
    const dow = t.date.getUTCDay();
    const atual = porDia.get(dow) ?? { bruto: 0, horas: 0, n: 0 };
    porDia.set(dow, {
      bruto: atual.bruto + t.grossCents,
      horas: atual.horas + t.hoursTenths,
      n: atual.n + 1,
    });
  }

  return DIAS.map((dia, i) => {
    const d = porDia.get(i);
    return {
      dia,
      trabalhos: d?.n ?? 0,
      brutoCents: d?.bruto ?? 0,
      horasDecimos: d?.horas ?? 0,
      brutoPorHoraCents:
        d && d.horas > 0 ? divRound(d.bruto * 10, d.horas) : null,
    };
  }).filter((d) => d.trabalhos > 0);
}
