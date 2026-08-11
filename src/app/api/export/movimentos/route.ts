import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { listTransactions } from "@/server/ledger";
import { resolvePeriod } from "@/lib/period";
import { todayIso } from "@/lib/date";

/**
 * Exportação dos movimentos em CSV.
 *
 * Protegida como qualquer página: sem sessão válida devolve 401 e não revela
 * nada. O `workspaceId` vem da sessão — não há forma de pedir os dados de
 * outra pessoa.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  }
  if (!can(session.role, "data:read")) {
    return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const period = resolvePeriod({
    periodo: params.get("periodo"),
    de: params.get("de"),
    ate: params.get("ate"),
    today: todayIso(session.timezone),
  });

  const { rows } = await listTransactions(
    session.workspaceId,
    { from: period.from, to: period.to },
    { take: 10_000 },
  );

  const header = [
    "Data",
    "Tipo",
    "Descrição",
    "Categoria",
    "Conta",
    "Conta destino",
    "Fonte",
    "Veículo",
    "Âmbito",
    "Valor (EUR)",
    "Notas",
  ];

  const TYPE_LABEL = {
    INCOME: "Receita",
    EXPENSE: "Despesa",
    TRANSFER: "Transferência",
  } as const;

  const body = rows.map((row) => [
    row.date,
    TYPE_LABEL[row.type],
    row.description,
    row.categoryName ?? "",
    row.accountName ?? "",
    row.toAccountName ?? "",
    row.incomeSourceName ?? "",
    row.vehicleName ?? "",
    row.scope === "BUSINESS" ? "Profissional" : "Pessoal",
    // Vírgula decimal: é o que o Excel em português espera.
    (row.type === "EXPENSE" ? -row.amountCents / 100 : row.amountCents / 100)
      .toFixed(2)
      .replace(".", ","),
    row.notes ?? "",
  ]);

  // Ponto e vírgula como separador (convenção pt-PT, porque a vírgula é o
  // separador decimal). BOM UTF-8 para o Excel não estragar os acentos.
  const csv =
    "﻿" +
    [header, ...body]
      .map((line) =>
        line
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(";"),
      )
      .join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="movimentos-${period.from}-a-${period.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
