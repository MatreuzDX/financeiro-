import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { recordAudit } from "@/server/audit";
import { todayIso } from "@/lib/date";

/**
 * Levar tudo embora, num ficheiro.
 *
 * Os dados são de quem os escreveu. Uma app que os prende é uma app em que
 * não se deve confiar — e é também o que o RGPD exige.
 *
 * Sai tudo o que a pessoa criou. NÃO sai nada de segredo: hashes de
 * palavra-passe, tokens e sessões ficam de fora, de propósito.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ erro: "Sem sessão." }, { status: 401 });
  }

  const workspaceId = session.workspaceId;

  const [
    contas,
    categorias,
    movimentos,
    fontes,
    veiculos,
    quilometragem,
    abastecimentos,
    trabalhos,
    orcamentos,
    recorrencias,
    metas,
  ] = await Promise.all([
    prisma.account.findMany({ where: { workspaceId } }),
    prisma.category.findMany({ where: { workspaceId } }),
    prisma.transaction.findMany({
      where: { workspaceId },
      include: { entries: true },
      orderBy: { date: "asc" },
    }),
    prisma.incomeSource.findMany({ where: { workspaceId } }),
    prisma.vehicle.findMany({ where: { workspaceId } }),
    prisma.mileageLog.findMany({ where: { workspaceId } }),
    prisma.fuelLog.findMany({ where: { workspaceId } }),
    prisma.workJob.findMany({ where: { workspaceId } }),
    prisma.budget.findMany({ where: { workspaceId }, include: { lines: true } }),
    prisma.recurringRule.findMany({ where: { workspaceId } }),
    prisma.goal.findMany({
      where: { workspaceId },
      include: { contributions: true },
    }),
  ]);

  const dados = {
    exportadoEm: new Date().toISOString(),
    aviso:
      "Valores monetários em cêntimos inteiros. Distâncias em metros. Litros em mililitros. Preços por litro em euros × 10 000.",
    conta: { nome: session.name, email: session.email },
    workspace: {
      nome: session.workspaceName,
      moeda: session.currency,
      fuso: session.timezone,
    },
    contas,
    categorias,
    movimentos,
    fontesDeRendimento: fontes,
    veiculos,
    quilometragem,
    abastecimentos,
    trabalhos,
    orcamentos,
    recorrencias,
    metas,
  };

  await recordAudit({
    action: "data.exported",
    workspaceId,
    userId: session.userId,
    userEmail: session.email,
    metadata: { movimentos: movimentos.length, contas: contas.length },
  });

  const nomeFicheiro = `financeiro-${todayIso(session.timezone)}.json`;

  return new NextResponse(JSON.stringify(dados, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeFicheiro}"`,
      // Nunca guardar em cache: é o retrato financeiro completo de alguém.
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
