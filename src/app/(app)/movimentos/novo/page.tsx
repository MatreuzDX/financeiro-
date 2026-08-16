import type { Metadata } from "next";
import { requireSession } from "@/server/auth/guard";
import { listAccounts } from "@/server/accounts";
import { listCategories } from "@/server/categories";
import { listIncomeSources } from "@/server/income-sources";
import { listVehicles } from "@/server/vehicles";
import { getTransaction } from "@/server/ledger";
import { todayIso } from "@/lib/date";
import { centsToInput } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import { TransactionForm } from "./transaction-form";

export const metadata: Metadata = { title: "Novo movimento" };

export default async function NovoMovimentoPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; copiar?: string }>;
}) {
  const session = await requireSession("/movimentos/novo");
  const params = await searchParams;

  // Duplicar: metade do que se regista já se registou antes. Copia-se tudo
  // menos a data, que passa a ser hoje — é isso que se quer em 99% dos casos.
  const original = params.copiar
    ? await getTransaction(session.workspaceId, params.copiar)
    : null;

  const [accounts, expense, income, sources, vehicles] = await Promise.all([
    listAccounts(session.workspaceId),
    listCategories(session.workspaceId, "EXPENSE"),
    listCategories(session.workspaceId, "INCOME"),
    listIncomeSources(session.workspaceId, true),
    listVehicles(session.workspaceId, true),
  ]);

  const initialType = original
    ? original.type
    : params.tipo === "receita"
      ? "INCOME"
      : params.tipo === "transferencia"
        ? "TRANSFER"
        : "EXPENSE";

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title={original ? "Duplicar movimento" : "Novo movimento"}
        description={
          original
            ? `Copiado de "${original.description}". A data ficou em hoje — confirme o resto.`
            : "Registe o que entrou, o que saiu, ou o que passou de uma conta para outra."
        }
      />
      <Card className="animate-rise">
        <TransactionForm
          accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
          expenseCategories={expense.map((c) => ({ id: c.id, name: c.name }))}
          incomeCategories={income.map((c) => ({ id: c.id, name: c.name }))}
          incomeSources={sources.map((s) => ({ id: s.id, name: s.name }))}
          vehicles={vehicles.map((v) => ({ id: v.id, name: v.name }))}
          today={todayIso(session.timezone)}
          initialType={initialType}
          initialValues={
            original
              ? {
                  amount: centsToInput(original.amountCents),
                  description: original.description,
                  // A data NÃO se copia: quem duplica está a registar hoje.
                  date: todayIso(session.timezone),
                  scope: original.scope,
                  accountId: original.accountId ?? "",
                  categoryId: original.categoryId ?? "",
                  notes: original.notes ?? "",
                }
              : undefined
          }
        />
      </Card>
    </div>
  );
}
