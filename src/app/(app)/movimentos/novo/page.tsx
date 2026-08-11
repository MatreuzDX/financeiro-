import type { Metadata } from "next";
import { requireSession } from "@/server/auth/guard";
import { listAccounts } from "@/server/accounts";
import { listCategories } from "@/server/categories";
import { listIncomeSources } from "@/server/income-sources";
import { listVehicles } from "@/server/vehicles";
import { todayIso } from "@/lib/date";
import { Card, PageHeader } from "@/components/ui";
import { TransactionForm } from "./transaction-form";

export const metadata: Metadata = { title: "Novo movimento" };

export default async function NovoMovimentoPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const session = await requireSession("/movimentos/novo");
  const params = await searchParams;

  const [accounts, expense, income, sources, vehicles] = await Promise.all([
    listAccounts(session.workspaceId),
    listCategories(session.workspaceId, "EXPENSE"),
    listCategories(session.workspaceId, "INCOME"),
    listIncomeSources(session.workspaceId, true),
    listVehicles(session.workspaceId, true),
  ]);

  const initialType =
    params.tipo === "receita"
      ? "INCOME"
      : params.tipo === "transferencia"
        ? "TRANSFER"
        : "EXPENSE";

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="Novo movimento"
        description="Registe o que entrou, o que saiu, ou o que passou de uma conta para outra."
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
        />
      </Card>
    </div>
  );
}
