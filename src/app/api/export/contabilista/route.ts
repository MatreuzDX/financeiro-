import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { listTransactions } from "@/server/ledger";
import { panoramaFiscal } from "@/server/fiscal";
import { formatCents } from "@/lib/money";
import { todayIso } from "@/lib/date";
import { recordAudit } from "@/server/audit";

/**
 * O pacote do trimestre, para mandar ao contabilista.
 *
 * Quem tem contabilista passa metade do tempo a copiar valores para um email.
 * Isto é um CSV com o trimestre inteiro, já separado entre pessoal e
 * profissional, com um cabeçalho que diz o que é e as somas em baixo.
 *
 * Só movimentos PROFISSIONAIS por omissão: o contabilista não precisa de
 * saber quanto se gastou no supermercado, e mandar-lhe isso é dar informação
 * pessoal a mais sem razão nenhuma.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (!can(session.role, "data:read")) {
    return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const hoje = todayIso(session.timezone);
  const ano = Number(params.get("ano") ?? hoje.slice(0, 4));
  const trimestre = Math.min(
    4,
    Math.max(1, Number(params.get("trimestre") ?? Math.ceil(Number(hoje.slice(5, 7)) / 3))),
  );

  const primeiroMes = (trimestre - 1) * 3 + 1;
  const ultimoMes = primeiroMes + 2;
  const ultimoDia = new Date(Date.UTC(ano, ultimoMes, 0)).getUTCDate();
  const de = `${ano}-${String(primeiroMes).padStart(2, "0")}-01`;
  const ate = `${ano}-${String(ultimoMes).padStart(2, "0")}-${ultimoDia}`;

  const [{ rows }, fiscal] = await Promise.all([
    listTransactions(session.workspaceId, { from: de, to: ate }, { take: 10_000 }),
    panoramaFiscal(session.workspaceId, session.timezone),
  ]);

  const profissionais = rows.filter((r) => r.scope === "BUSINESS");
  const receitas = profissionais.filter((r) => r.type === "INCOME");
  const despesas = profissionais.filter((r) => r.type === "EXPENSE");
  const soma = (lista: typeof rows) => lista.reduce((s, r) => s + r.amountCents, 0);

  const linhas: string[][] = [
    [`Movimentos profissionais — ${trimestre}.º trimestre de ${ano}`],
    [`Período: ${de} a ${ate}`],
    [
      "Regime:",
      fiscal.perfil.independente
        ? fiscal.perfil.regimeIva === "NORMAL"
          ? "Independente, IVA regime normal"
          : "Independente, isento art. 53.º"
        : "Não configurado como independente",
    ],
    [],
    ["Data", "Tipo", "Descrição", "Categoria", "Conta", "Valor (EUR)", "Notas"],
  ];

  for (const r of [...receitas, ...despesas]) {
    linhas.push([
      r.date,
      r.type === "INCOME" ? "Receita" : "Despesa",
      r.description,
      r.categoryName ?? "",
      r.accountName ?? "",
      ((r.type === "EXPENSE" ? -r.amountCents : r.amountCents) / 100)
        .toFixed(2)
        .replace(".", ","),
      r.notes ?? "",
    ]);
  }

  linhas.push(
    [],
    ["Total de receitas", "", "", "", "", (soma(receitas) / 100).toFixed(2).replace(".", ",")],
    ["Total de despesas", "", "", "", "", (soma(despesas) / 100).toFixed(2).replace(".", ",")],
    [],
    ["ESTIMATIVAS — conferir, não são declarações"],
    ["Faturado no ano até hoje", formatCents(fiscal.faturadoAnoCents)],
  );

  for (const p of fiscal.reservaAno.parcelas) {
    linhas.push([`${p.titulo} (estimativa, ano)`, formatCents(p.cents), p.conta]);
  }

  linhas.push(
    [],
    [
      "Nota: valores apurados pela aplicação a partir dos movimentos registados.",
    ],
    [
      "As estimativas de imposto usam as taxas configuradas e NÃO substituem o apuramento oficial.",
    ],
  );

  // BOM UTF-8 e ponto e vírgula: convenção pt-PT, para o Excel abrir direito.
  const csv =
    "﻿" +
    linhas
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");

  await recordAudit({
    action: "data.exported",
    workspaceId: session.workspaceId,
    userId: session.userId,
    userEmail: session.email,
    metadata: { tipo: "contabilista", trimestre, ano, linhas: profissionais.length },
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contabilista-${ano}-T${trimestre}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
